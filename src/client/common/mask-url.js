/**
 * Hide the secrets a widget's server URL can carry, for display only.
 *
 * These URLs are shown in the widget panel and in the start-up notification,
 * both of which get screenshotted into issues, so the password of a local FTP
 * server and the API key of the MCP server must not be readable there. Copy
 * still copies the real string — the copy handlers use serverInfo.url directly.
 */
export function maskUrl (url) {
  return String(url || '')
    // scheme://user:password@host
    .replace(/\/\/([^:/@]+):([^@/]+)@/, '//$1:••••••@')
    // ?apiKey=… / &token=… in the query
    .replace(/([?&](?:apiKey|api_key|token|key)=)[^&#]*/gi, '$1••••••')
}
