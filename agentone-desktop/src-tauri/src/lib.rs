use std::collections::HashMap;
use std::sync::Mutex;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

const CHAT_EVENT: &str = "chat://stream";

#[derive(Default)]
struct StreamState {
    handles: Mutex<HashMap<String, tauri::async_runtime::JoinHandle<()>>>,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct StreamArgs {
    request_id: String,
    base_url: String,
    api_key: String,
    agent_id: String,
    message: String,
    session_id: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ChatEvent {
    request_id: String,
    kind: String,
    data: String,
}

#[derive(Serialize)]
struct TestResult {
    ok: bool,
    message: String,
}

fn emit_event(app: &AppHandle, request_id: &str, kind: &str, data: &str) {
    let _ = app.emit(
        CHAT_EVENT,
        ChatEvent {
            request_id: request_id.to_string(),
            kind: kind.to_string(),
            data: data.to_string(),
        },
    );
}

fn truncate(s: &str, max: usize) -> String {
    let t = s.trim();
    if t.chars().count() > max {
        let mut out: String = t.chars().take(max).collect();
        out.push('…');
        out
    } else {
        t.to_string()
    }
}

/// 解析单个 SSE 事件并派发；返回 true 表示流应终止（done/error）。
fn dispatch_event(app: &AppHandle, request_id: &str, raw: &str) -> bool {
    if raw.trim().is_empty() {
        return false;
    }
    let mut event = String::from("message");
    let mut data = String::new();
    for line in raw.split('\n') {
        if let Some(rest) = line.strip_prefix("event:") {
            event = rest.trim().to_string();
        } else if let Some(rest) = line.strip_prefix("data:") {
            // SSE 规范：`data:` 后至多一个可选空格，需保留其余空白以免丢失增量文本
            let piece = rest.strip_prefix(' ').unwrap_or(rest);
            if !data.is_empty() {
                data.push('\n');
            }
            data.push_str(piece);
        }
    }
    match event.as_str() {
        "session" => {
            emit_event(app, request_id, "session", data.trim());
            false
        }
        "thinking" => {
            emit_event(app, request_id, "thinking", &data);
            false
        }
        "delta" => {
            if !data.is_empty() {
                emit_event(app, request_id, "delta", &data);
            }
            false
        }
        "error" => {
            emit_event(app, request_id, "error", data.trim());
            true
        }
        "done" => {
            emit_event(app, request_id, "done", "");
            true
        }
        _ => {
            if data.trim() == "[DONE]" {
                emit_event(app, request_id, "done", "");
                true
            } else if !data.is_empty() {
                emit_event(app, request_id, "delta", &data);
                false
            } else {
                false
            }
        }
    }
}

fn drain_buffer(app: &AppHandle, request_id: &str, buffer: &mut String) -> bool {
    while let Some(idx) = buffer.find("\n\n") {
        let raw = buffer[..idx].to_string();
        *buffer = buffer[idx + 2..].to_string();
        if dispatch_event(app, request_id, &raw) {
            buffer.clear();
            return true;
        }
    }
    false
}

async fn run_stream(app: &AppHandle, args: StreamArgs) {
    let request_id = args.request_id.clone();
    let url = format!("{}/v1/chat/stream", args.base_url.trim_end_matches('/'));
    let body = serde_json::json!({
        "agentId": args.agent_id,
        "message": args.message,
        "sessionId": args.session_id,
        "stream": true,
        "attachmentIds": []
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("X-API-Key", &args.api_key)
        .header("Accept", "text/event-stream")
        .json(&body)
        .send()
        .await;

    let resp = match resp {
        Ok(r) => r,
        Err(e) => {
            emit_event(app, &request_id, "error", &format!("连接失败：{e}"));
            return;
        }
    };

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        emit_event(
            app,
            &request_id,
            "error",
            &format!("HTTP {status}：{}", truncate(&text, 300)),
        );
        return;
    }

    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(bytes) => {
                buffer.push_str(&String::from_utf8_lossy(&bytes));
                // 归一化 CRLF：需在整段 buffer 上做，避免 `\r` 与 `\n` 被 TCP 分到相邻 chunk 时漏替换
                if buffer.contains("\r\n") {
                    buffer = buffer.replace("\r\n", "\n");
                }
                if drain_buffer(app, &request_id, &mut buffer) {
                    return;
                }
            }
            Err(e) => {
                emit_event(app, &request_id, "error", &format!("读取流失败：{e}"));
                return;
            }
        }
    }

    if !buffer.trim().is_empty() {
        let raw = std::mem::take(&mut buffer);
        if dispatch_event(app, &request_id, &raw) {
            return;
        }
    }
    emit_event(app, &request_id, "done", "");
}

#[tauri::command]
async fn stream_chat(
    app: AppHandle,
    state: State<'_, StreamState>,
    args: StreamArgs,
) -> Result<(), String> {
    let request_id = args.request_id.clone();
    let app_handle = app.clone();
    let handle = tauri::async_runtime::spawn(async move {
        run_stream(&app_handle, args).await;
    });
    let mut map = state.handles.lock().map_err(|e| e.to_string())?;
    map.insert(request_id, handle);
    Ok(())
}

#[tauri::command]
fn abort_chat(state: State<'_, StreamState>, request_id: String) {
    if let Ok(mut map) = state.handles.lock() {
        if let Some(handle) = map.remove(&request_id) {
            handle.abort();
        }
    }
}

#[tauri::command]
async fn test_connection(base_url: String, api_key: String) -> Result<TestResult, String> {
    let url = format!("{}/v1/health", base_url.trim_end_matches('/'));
    let client = reqwest::Client::new();
    match client.get(&url).header("X-API-Key", api_key).send().await {
        Ok(resp) if resp.status().is_success() => {
            let body = resp.text().await.unwrap_or_default();
            Ok(TestResult {
                ok: true,
                message: format!("连接正常：{}", truncate(&body, 120)),
            })
        }
        Ok(resp) => Ok(TestResult {
            ok: false,
            message: format!("服务器返回 HTTP {}", resp.status()),
        }),
        Err(e) => Ok(TestResult {
            ok: false,
            message: format!("无法连接：{e}"),
        }),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(StreamState::default())
        .invoke_handler(tauri::generate_handler![
            stream_chat,
            abort_chat,
            test_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}