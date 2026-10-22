/**
 * Tabs whose last connection attempt ended without an answer to an interactive
 * prompt: the user cancelled it, or it sat unanswered until the handshake timed
 * out and the server took it back.
 *
 * Auto reconnect has to skip those. The next attempt asks the same question
 * (an MFA code, a password, a host key decision) and nothing but a human can
 * answer it, so retrying forever only stacks dead prompts on top of the app -
 * the endless reconnect with an un-closable MFA dialog in #4634. The prompt
 * itself lives in `terminal-interactive.jsx`, a single global component with no
 * per-tab lifecycle to hang this state on, so it is kept here.
 *
 * Keyed by tab id, and `reloadTab` always mints a new one, so a fresh attempt
 * starts clean even before `remoteInit` clears it explicitly.
 */

const tabs = new Set()

export const markNeedsInteractiveInput = tabId => {
  if (tabId) {
    tabs.add(tabId)
  }
}

export const clearNeedsInteractiveInput = tabId => {
  if (tabId) {
    tabs.delete(tabId)
  }
}

export const needsInteractiveInput = tabId => !!tabId && tabs.has(tabId)
