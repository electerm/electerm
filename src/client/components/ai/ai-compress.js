/**
 * Runtime side of AI context compression.
 *
 * The pure decisions and message rewrites live in ai-auto-compress.js; this
 * module owns the parts that need the provider (the summary request) and the
 * store (whether the toggle is on, how big a stored session is, compressing it).
 * Both the agent loop and ask mode go through here so "too full" means the same
 * number in both.
 */

import { buildSessionMessages, summarizeContext } from './ai-context'
import { appendMandatoryGuardrails } from './ai-guardrails'
import {
  COMPRESS_SUMMARY_PROMPT,
  shouldAutoCompress
} from './ai-auto-compress'

// Read at the moment of the decision, not captured: the toggle can be flipped
// from the popover while a run is in flight.
export function autoCompressEnabled () {
  return !!(window.store && window.store.aiAutoCompress)
}

// Ask the model for the summary that replaces a conversation. Goes through the
// plain chat path rather than the tool loop: this request only has to produce
// text, and giving it tools would let the summarizer act on the terminal while
// it is supposed to be reading. Returns '' when there is nothing usable, which
// callers read as "leave the conversation alone".
export async function summarizeMessages (messages, config = {}) {
  try {
    const result = await window.pre.runGlobalAsync(
      'AIchat',
      COMPRESS_SUMMARY_PROMPT,
      config.modelAI,
      config.roleAI,
      config.baseURLAI,
      config.apiPathAI,
      config.apiKeyAI,
      config.proxyAI,
      false,
      config.authHeaderNameAI,
      [...messages, { role: 'user', content: COMPRESS_SUMMARY_PROMPT }]
    )
    if (!result || result.error || !result.response) {
      return ''
    }
    return result.response
  } catch (error) {
    console.error('Error summarizing conversation:', error)
    return ''
  }
}

// How big the stored session is, i.e. what the next ask-mode turn would carry.
// Same figure the panel's own indicator shows (components/ai/ai-chat.jsx), minus
// agent tools, which only agent mode sends.
export function sessionContextInfo (sessionId, config = {}) {
  const store = window.store
  if (!sessionId || !store) {
    return null
  }
  const lang = config.languageAI || store.getLangName()
  const role = appendMandatoryGuardrails((config.roleAI || '') + `;用[${lang}]回复`)
  const messages = buildSessionMessages({
    history: store.aiChatHistory,
    chatSessionId: sessionId,
    role
  })
  if (!messages || messages.length < 2) {
    return null
  }
  return summarizeContext(messages, {
    model: config.modelAI,
    contextLength: store.config.contextLengthAI
  })
}

// Compact a stored session when the toggle is on and it is over the line.
// Called once a turn or a run is finished, so the *next* request starts from the
// summary instead of the full history. Returns true when it compressed.
export async function autoCompressSession (sessionId, config = {}) {
  if (!autoCompressEnabled() || !sessionId) {
    return false
  }
  if (!shouldAutoCompress(sessionContextInfo(sessionId, config))) {
    return false
  }
  try {
    await window.store.compressChatSession(sessionId)
    return true
  } catch (error) {
    console.error('Error auto compressing session:', error)
    return false
  }
}
