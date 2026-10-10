import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true, gfm: true })

/** 渲染 Markdown 并做 XSS 净化（Agent 输出不可信） */
export function renderMarkdown(text: string): string {
  if (!text) return ''
  try {
    return DOMPurify.sanitize(marked.parse(text) as string)
  } catch {
    return DOMPurify.sanitize(text)
  }
}