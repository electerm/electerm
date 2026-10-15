/**
 * Upload size limit for the electerm-cloud sync API.
 *
 * Kept in step with electerm-cloud/src/server/control/sync-limits.ts. The
 * server publishes the value on every response as `X-Sync-Max-KB`, but the
 * client has to warn *before* it has ever talked to the server, so it carries
 * its own copy.
 *
 * Compression does NOT raise this number. The server compresses only after it
 * has already checked the raw payload, so this stays a hard ceiling on how
 * much data can be synced at all; gzip makes the resulting row cheaper to
 * write, not the upload bigger.
 *
 * Deliberately dependency-free — no imports, no `window` — so the unit-ci
 * suite can exercise it directly without an Electron renderer.
 */

export const maxSyncPayloadKb = 280

export const maxSyncPayload = maxSyncPayloadKb * 1024

// Warn this close to the cap, while the sync still succeeds, so the user is
// not surprised by the refusal later.
export const syncWarnRatio = 0.8

/**
 * Byte length of the JSON body electerm-sync is about to PUT.
 *
 * Not `String.length`: bookmark titles, hostnames and passwords are routinely
 * non-ASCII and the wire is UTF-8, so a character count can understate a
 * Chinese bookmark set by 3x.
 */
export function payloadSize (obj) {
  return new TextEncoder().encode(JSON.stringify(obj)).length
}

/**
 * Classify an upload against the cap.
 *
 * Returns `{ bytes, kb, level }` with level 'ok' | 'warn' | 'over'.
 *
 * The server's cap is applied to the raw payload before it is compressed, so a
 * payload over it comes back as a 413 that surfaces in the UI as a bare
 * HTTPError. Checking here turns that into a message naming the actual size and
 * the limit.
 */
export function checkSyncPayloadSize (obj) {
  const bytes = payloadSize(obj)
  const kb = Math.ceil(bytes / 1024)
  const level = bytes > maxSyncPayload
    ? 'over'
    : bytes > maxSyncPayload * syncWarnRatio ? 'warn' : 'ok'
  return { bytes, kb, level }
}

export function tooLargeMessage (kb) {
  return `Sync data too large: ${kb}KB, max ${maxSyncPayloadKb}KB. ` +
    'Try syncing fewer data types, or delete unused bookmarks.'
}

export function nearLimitMessage (kb) {
  return `Sync data is close to the limit: ${kb}KB of ${maxSyncPayloadKb}KB max`
}
