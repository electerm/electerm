/**
 * Retry wrapper for dynamic import() calls
 * Handles transient "Failed to fetch" errors that can occur
 * when the app starts and chunks are fetched before the
 * network/server is fully ready
 */

const MAX_RETRIES = 3
const RETRY_DELAY = 500

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default function importRetry (factory, retries = MAX_RETRIES) {
  return factory().catch(async (err) => {
    if (retries <= 0) {
      throw err
    }
    await sleep(RETRY_DELAY)
    return importRetry(factory, retries - 1)
  })
}
