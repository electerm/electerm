// Automatic context compression, shared by agent mode and ask mode.
//
// A request is not just the conversation: agent runs append the assistant's
// tool calls and their results on every iteration, ask turns append the answer
// of every turn. Either way the request that leaves the machine grows past what
// the session transcript suggests, and once it approaches the model's window
// the provider starts rejecting it outright, which kills the run mid-way. The
// fix is the same one the manual Compress button performs -- replace the
// history with a summary -- except it has to happen before the request that
// would overflow.
//
// Pure module (no window / store access) so the decision and the rewrite can
// be unit tested, and so the manual and the automatic path share one summary
// prompt and one message shape. The request that asks for a summary lives in
// ai-compress.js.

import { CONTEXT_DANGER_PERCENT } from './ai-context.js'

// Sent as the closing user turn when asking for a summary. Shared with the
// manual path (store.compressChatSession) so both produce the same thing.
export const COMPRESS_SUMMARY_PROMPT = 'Please summarize the above conversation concisely. Include key information, decisions, context, and any important details that would be needed to continue this conversation effectively.'

// `info` is the object summarizeContext returns. Percent is null/absent when
// the window size is unknown, which must not read as "0, no compression
// needed" -- there is simply nothing to decide on.
//
// The threshold is the danger level from ai-context.js, read here rather than
// copied into a constant of this module: the same value is what turns the
// context indicator red, and a live read cannot be left behind in a stale copy
// of this file when that value is edited (which is how "I set it to 5 and it
// still did not compress" happens).
export function shouldAutoCompress (info, percent = CONTEXT_DANGER_PERCENT) {
  if (!info) {
    return false
  }
  const p = info.percent
  if (p === null || p === undefined || !isFinite(p)) {
    return false
  }
  return p >= percent
}

// There has to be something a summary can replace. A fresh request is just the
// system prompt plus the prompt being sent; compacting that would only re-word
// the question, so a model whose tool schemas alone fill the window is left
// alone rather than sent a summary request on every turn.
export function canCompact (messages) {
  return Array.isArray(messages) && messages.length > 2
}

// An ask-mode request ends with the prompt being answered, because
// buildSessionMessages appends each turn's prompt after the earlier ones.
// Compaction must keep that last message out of the summary: it is the live
// question, and folding it into "here is a summary of our previous
// conversation" would ask the model to answer a question it only sees quoted
// back at it.
export function splitPendingTurn (messages) {
  if (!Array.isArray(messages)) {
    return { context: [], pending: null }
  }
  const last = messages[messages.length - 1]
  if (last && last.role === 'user') {
    return { context: messages.slice(0, -1), pending: last }
  }
  return { context: messages, pending: null }
}

// How a summary re-enters the conversation. Deliberately the same pair
// buildSessionMessages emits for a compressed session entry, so a live loop
// that compacted itself and a session compressed between turns read
// identically to the model.
export function summaryMessages (summary) {
  return [
    {
      role: 'user',
      content: `Here is a summary of our previous conversation for context:\n\n${summary}`
    },
    {
      role: 'assistant',
      content: 'Understood. I will use this context as we continue.'
    }
  ]
}

// Compact `messages` in place: the system prompt stays (it carries the agent
// instructions and guardrails), everything the summary covers is dropped.
// In place because the agent loop holds this exact array for its next request.
export function applySummary (messages, summary) {
  if (!Array.isArray(messages) || !summary) {
    return messages
  }
  const system = messages.find(m => m && m.role === 'system')
  messages.length = 0
  if (system) {
    messages.push(system)
  }
  messages.push(...summaryMessages(summary))
  return messages
}

// The ask-mode counterpart, returning a new list: the memoized session messages
// this turn was built from must not be modified, and the live prompt has to be
// re-attached after the summary.
export function compactAskMessages (messages, summary) {
  if (!Array.isArray(messages) || !summary) {
    return messages
  }
  const { pending } = splitPendingTurn(messages)
  const system = messages.find(m => m && m.role === 'system')
  const next = []
  if (system) {
    next.push(system)
  }
  next.push(...summaryMessages(summary))
  if (pending) {
    next.push(pending)
  }
  return next
}
