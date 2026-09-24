// Context accounting for the AI panel: how big is the conversation we are
// about to send, and how much of the model's context window does it fill.
//
// There is deliberately no tokenizer here. A real one needs the model's
// vocabulary (tiktoken & friends) and would pull a dependency into the
// renderer for a number that only has to be good enough to answer "should I
// compress?". The heuristic below is CJK aware and deliberately pessimistic,
// so the warning arrives a little early rather than too late. Where the
// provider reports real usage we show that number alongside the estimate.
//
// Pure module -- no window / store access -- so it can be unit tested and so
// the sender and the indicator cannot drift apart.

// Latin text and code average ~4 chars per token; 3.5 is the safe side.
const CHARS_PER_TOKEN = 3.5
// CJK is roughly one token per character (a little under for Chinese).
const TOKENS_PER_CJK_CHAR = 0.8
// Per message role/delimiter overhead, as counted by the OpenAI tokenizer.
const PER_MESSAGE_OVERHEAD = 4

// BMP ranges that tokenize densely: CJK ideographs, kana, full width forms.
const CJK_RE = /[\u2e80-\u2eff\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/g

export const DEFAULT_CONTEXT_WINDOW = 128000
export const CONTEXT_WARN_PERCENT = 70
export const CONTEXT_DANGER_PERCENT = 90

// Rough token count of a string. Never exact, never wildly wrong. Called on
// the whole conversation every time it changes, so it stays a single pass
// with one regex sweep rather than a per character test.
export function estimateTokens (text) {
  if (!text) {
    return 0
  }
  const str = typeof text === 'string' ? text : String(text)
  const cjkChars = str.match(CJK_RE)
  const cjk = cjkChars ? cjkChars.length : 0
  const other = str.length - cjk
  return Math.ceil(cjk * TOKENS_PER_CJK_CHAR + other / CHARS_PER_TOKEN)
}

// Tokens for a message array in the OpenAI chat shape (which is also what the
// anthropic / responses builders are fed before they re-shape it).
export function estimateMessagesTokens (messages) {
  if (!Array.isArray(messages)) {
    return 0
  }
  let total = 0
  for (const m of messages) {
    if (!m) {
      continue
    }
    total += PER_MESSAGE_OVERHEAD
    total += estimateTokens(m.content)
    if (m.role) {
      total += estimateTokens(m.role)
    }
    if (Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) {
        total += estimateTokens(tc && tc.id)
        total += estimateTokens(tc && tc.function && tc.function.name)
        total += estimateTokens(tc && tc.function && tc.function.arguments)
      }
    }
  }
  return total
}

// Tool schemas are re-sent with every agent request and are far from free --
// ignoring them would understate agent mode by a few thousand tokens.
export function estimateToolsTokens (tools) {
  if (!Array.isArray(tools) || !tools.length) {
    return 0
  }
  try {
    return estimateTokens(JSON.stringify(tools))
  } catch (e) {
    return 0
  }
}

// Best effort hints, checked 2026-09. No provider publishes the window over
// the API, and relays rename models freely, so this is only a starting point:
// the "Context length" field in the AI config always wins over it.
// Longest / most specific pattern first -- the list is scanned in order.
const MODEL_CONTEXT_WINDOWS = [
  [/qwen-?long/, 10000000],

  // 1M class
  [/gpt-6|gpt-5\.6|gpt-5-6/, 1050000],
  [/gemini/, 1048576],
  [/claude-(opus|sonnet|fable)-5/, 1000000],
  [/deepseek-v4/, 1000000],
  [/qwen3\.(7|8)|qwen3-max|qwen3\.5-max/, 1000000],
  [/kimi-?k3/, 1048576],

  // 500k / 400k / 256k class
  [/grok-4\.6/, 500000],
  [/gpt-5/, 400000],
  [/kimi-?k2\.7/, 262144],
  [/grok-4/, 256000],

  // 200k class
  [/claude/, 200000],
  [/\bo[134]\b/, 200000],

  // 128k class
  [/gpt-4\.1|gpt-4o|gpt-4-turbo|gpt-4-1106|gpt-4-0125/, 128000],
  [/llama-?[34]/, 131072],
  [/qwen/, 131072],
  [/kimi|moonshot/, 131072],
  [/glm|zhipu|chatglm/, 131072],
  [/ernie|wenxin/, 131072],
  [/grok/, 131072],
  [/mistral-large/, 131072],

  // older / smaller
  [/deepseek/, 65536],
  [/gpt-4-32k/, 32768],
  [/mixtral|mistral/, 32768],
  [/gpt-3\.5/, 16385],
  [/gpt-4/, 8192],
  [/llama-?2/, 4096]
]

// Returns { size, source } where source is 'config' | 'model' | 'default'.
export function getContextWindow (model, override) {
  const declared = Number(override)
  if (declared > 0) {
    return { size: declared, source: 'config' }
  }
  const id = String(model || '').toLowerCase()
  for (const [re, size] of MODEL_CONTEXT_WINDOWS) {
    if (re.test(id)) {
      return { size, source: 'model' }
    }
  }
  return { size: DEFAULT_CONTEXT_WINDOW, source: 'default' }
}

// The single source of truth for "what gets sent": both the request in
// ai-chat-history-item.jsx and the indicator in ai-chat.jsx go through here,
// so the number on screen is the number that leaves the machine.
//
// Returns null when there is no session to build from -- the sender reads
// that as "no history", and the main process then falls back to a plain
// prompt + role request.
//
// `upto` limits the window to entries at or before a timestamp (the entry
// being sent); `excludeId` drops one entry's response, which is what the
// sender does for its own turn. The indicator omits both to describe the
// *next* request, which will include every response so far.
export function buildSessionMessages ({
  history,
  chatSessionId,
  upto = Infinity,
  role = '',
  excludeId = null
}) {
  if (!chatSessionId) {
    return null
  }
  const entries = (history || [])
    .filter(h => h.chatSessionId === chatSessionId && h.timestamp <= upto)
    .sort((a, b) => a.timestamp - b.timestamp)

  // A compressed entry replaces everything before it.
  let lastCompressIndex = -1
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].compressed) {
      lastCompressIndex = i
      break
    }
  }

  const messages = [
    { role: 'system', content: role }
  ]

  const startIndex = lastCompressIndex >= 0 ? lastCompressIndex : 0
  for (let i = startIndex; i < entries.length; i++) {
    const entry = entries[i]
    if (entry.compressed) {
      messages.push({
        role: 'user',
        content: `Here is a summary of our previous conversation for context:\n\n${entry.response}`
      })
      messages.push({
        role: 'assistant',
        content: 'Understood. I will use this context as we continue.'
      })
    } else {
      messages.push({
        role: 'user',
        // promptWithAttachments carries the inlined file blocks;
        // falls back to the plain prompt for legacy entries
        content: entry.promptWithAttachments || entry.prompt
      })
      if (entry.response && entry.id !== excludeId) {
        messages.push({ role: 'assistant', content: entry.response })
      }
    }
  }
  return messages
}

// Agent mode keeps the session history but swaps in its own system prompt.
export function buildAgentMessages ({ systemPrompt, conversationMessages, prompt }) {
  if (conversationMessages && conversationMessages.length > 1) {
    return [
      { role: 'system', content: systemPrompt },
      ...conversationMessages.filter(m => m.role !== 'system')
    ]
  }
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt }
  ]
}

// Everything the indicator needs, from the messages that will be sent.
export function summarizeContext (messages, { model, contextLength, tools } = {}) {
  const messagesTokens = estimateMessagesTokens(messages)
  const toolsTokens = estimateToolsTokens(tools)
  const tokens = messagesTokens + toolsTokens
  const win = getContextWindow(model, contextLength)
  return {
    tokens,
    messagesTokens,
    toolsTokens,
    windowSize: win.size,
    windowSource: win.source,
    percent: win.size ? (tokens / win.size) * 100 : null,
    model: model || '',
    measuredTokens: null
  }
}

export function formatTokens (n) {
  const v = Number(n) || 0
  if (v < 1000) {
    return String(Math.round(v))
  }
  if (v < 10000) {
    return (v / 1000).toFixed(1) + 'k'
  }
  if (v < 1000000) {
    return Math.round(v / 1000) + 'k'
  }
  return (v / 1000000).toFixed(1) + 'M'
}

export function formatPercent (p) {
  if (p === null || p === undefined || !isFinite(p)) {
    return ''
  }
  // below 10% a whole number would just read as 0%
  return (p > 0 && p < 10 ? p.toFixed(1) : String(Math.round(p))) + '%'
}

export function getUsageLevel (percent) {
  if (percent === null || percent === undefined || !isFinite(percent)) {
    return 'unknown'
  }
  if (percent >= CONTEXT_DANGER_PERCENT) {
    return 'danger'
  }
  if (percent >= CONTEXT_WARN_PERCENT) {
    return 'warn'
  }
  return 'ok'
}
