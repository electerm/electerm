/**
 * electerm-widget:// adapter for Electron < 25.
 *
 * NOT part of the shipped sources on a normal build. src/build/bin/inject-
 * polyfills.js copies this file into the packaged app (`work/app/widgets/`)
 * only when the target Electron is older than 25, and rewrites the body of
 * initWidgetProtocol() in widgets/protocol.js to call it. A modern build never
 * sees this file at all.
 *
 * Why a separate implementation:
 * - `protocol.handle()` and the global `Response` only exist from Electron 25 /
 *   Node 18. Electron 22 (our legacy target, pinned for old glibc) has neither.
 * - The callback protocols of that era have a rule that is easy to miss: a
 *   mimeType carrying parameters ("text/html; charset=utf-8") makes Chromium
 *   treat the document as plain text, so the charset has to travel in its own
 *   `charset` field. Verified against Electron 22.3.27.
 * - A callback can report exactly one failure: a net error code.
 *
 * The resolution rules themselves stay in protocol.js (resolveWidgetRequest)
 * and are passed in, so both adapters serve the same files with the same types.
 */

const fs = require('fs')

// net::ERR_FILE_NOT_FOUND, the only error a callback protocol can report.
const ERR_FILE_NOT_FOUND = -6

function splitMimeType (mimeType) {
  const [type, ...params] = mimeType.split(';').map(s => s.trim())
  const charset = params.find(p => /^charset=/i.test(p))
  return {
    mimeType: type,
    charset: charset ? charset.slice(charset.indexOf('=') + 1).trim() : ''
  }
}

function serveWidgetFile (request, resolveRequest, done) {
  let res
  try {
    res = resolveRequest(request.url)
  } catch (e) {
    return done({ error: ERR_FILE_NOT_FOUND })
  }
  if (!res || res.status !== 200) {
    return done({ error: ERR_FILE_NOT_FOUND })
  }
  try {
    const data = res.body || fs.readFileSync(res.file)
    const reply = splitMimeType(res.mimeType)
    reply.data = data
    if (!reply.charset) {
      delete reply.charset
    }
    done(reply)
  } catch (e) {
    done({ error: ERR_FILE_NOT_FOUND })
  }
}

function initWidgetProtocol (protocol, scheme, resolveRequest) {
  protocol.registerBufferProtocol(scheme, (request, done) => {
    serveWidgetFile(request, resolveRequest, done)
  })
}

module.exports = {
  ERR_FILE_NOT_FOUND,
  splitMimeType,
  serveWidgetFile,
  initWidgetProtocol
}
