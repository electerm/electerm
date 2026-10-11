// Browser-safe stub for Node's `node:diagnostics_channel` module.
//
// Why this exists:
//   @xterm/addon-ligatures (beta line) bundles lru-cache@11, which imports
//   `channel`/`tracingChannel` from `node:diagnostics_channel` and calls them at
//   module-load time (for optional metrics). In the Electron renderer / Vite dev
//   server this is a browser context: Vite stubs Node builtins with a
//   `browser-external` shim that throws on use, so `channel()` is undefined and
//   the addon crashes on import.
//
// lru-cache only publishes metrics when `hasSubscribers` is true, which never
// happens here (we never subscribe). So all of these can be silent no-ops.

function makeChannel () {
  return {
    publish () {},
    subscribe () {
      return () => {}
    },
    unsubscribe () {},
    bindStore (store) {
      return store
    },
    unbindStore () {},
    hasSubscribers: false
  }
}

export function channel () {
  return makeChannel()
}

export function tracingChannel () {
  const ch = makeChannel()
  return {
    start: ch,
    end: ch,
    asyncStart: ch,
    asyncEnd: ch,
    error: ch,
    trace (fn) {
      return fn()
    }
  }
}

export function hasSubscribers () {
  return false
}

export default {
  channel,
  tracingChannel,
  hasSubscribers
}
