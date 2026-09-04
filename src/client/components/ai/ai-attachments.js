// text file attachment support for AI chat
// only text files are supported: content is read and inlined
// into the prompt, images/binaries are rejected
import uid from '../../common/uid'

export const MAX_ATTACHMENT_FILE_SIZE = 50 * 1024
export const MAX_ATTACHMENT_TOTAL_SIZE = 100 * 1024

const BINARY_SNIFF_LEN = 8 * 1024
const decoder = new TextDecoder('utf-8')

// binary check: null byte anywhere, or too many control chars
function looksLikeText (buf) {
  const len = Math.min(buf.byteLength, BINARY_SNIFF_LEN)
  if (!len) {
    return false
  }
  const arr = new Uint8Array(buf, 0, len)
  let control = 0
  for (const b of arr) {
    if (b === 0) {
      return false
    }
    if (b < 9 || (b > 13 && b < 32)) {
      control++
    }
  }
  return control / len <= 0.1
}

// trailing U+FFFD means a multi-byte char got cut at the size boundary
function stripTrailingBadChars (str) {
  let end = str.length
  while (end > 0 && str[end - 1] === '\uFFFD') {
    end--
  }
  return str.slice(0, end)
}

export async function readTextAttachment (file) {
  const buf = await file.slice(0, MAX_ATTACHMENT_FILE_SIZE).arrayBuffer()
  if (!looksLikeText(buf)) {
    return {
      error: 'notTextFile'
    }
  }
  const truncated = file.size > MAX_ATTACHMENT_FILE_SIZE
  let content = stripTrailingBadChars(decoder.decode(buf))
  if (truncated) {
    content += '\n...[truncated]'
  }
  return {
    attachment: {
      id: uid(),
      name: file.name,
      size: file.size,
      truncated,
      content
    }
  }
}

export function validateAttachmentTotal (list, extraSize = 0) {
  const total = list.reduce((s, a) => s + a.size, 0) + extraSize
  return total <= MAX_ATTACHMENT_TOTAL_SIZE
}

export function formatSize (n) {
  if (n < 1024) {
    return n + ' B'
  }
  if (n < 1024 * 1024) {
    return (n / 1024).toFixed(1) + ' KB'
  }
  return (n / 1024 / 1024).toFixed(1) + ' MB'
}

export function buildAttachmentsBlock (attachments) {
  if (!attachments || !attachments.length) {
    return ''
  }
  return attachments.map(a => {
    const name = String(a.name).replace(/"/g, "'")
    const attr = a.truncated ? ' truncated="true"' : ''
    return `<file name="${name}"${attr}>\n${a.content}\n</file>`
  }).join('\n\n')
}
