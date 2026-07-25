/**
 * contants shared in app/client
 */

exports.userConfigId = 'userConfig'
exports.userNoEncryptConfigId = 'userConfigNoEncrypt'
// Server-managed config keys that must never be persisted to (or read
// from) the user-config database, because they are specific to the
// running server instance and are injected at runtime from process.env
// or generated values.  Overwriting tokenElecterm in particular breaks
// every subsequent WebSocket connection (terminals, sftp, transfers)
// because the token no longer matches the server's JWT secret, causing
// connections to silently fail verification — the terminal appears to
// connect but input never works until the app is restarted.
//
// Note: the client-side sync.js has an additional `useSystemTitleBar`
// key in its serverManagedConfigKeys list.  That key is a legitimate
// user preference (toggleable in Settings) and is only stripped when
// *importing* a synced config on the client; it must NOT be stripped
// here because saveUserConfig is called for every config change,
// including normal user edits.
exports.serverManagedConfigKeys = [
  'tokenElecterm',
  'host',
  'port',
  'server',
  'wsHost',
  'wsPort',
  'terminalTypes'
]

exports.instSftpKeys = [
  'connect',
  'list',
  'download',
  'upload',
  'mkdir',
  'getHomeDir',
  'rmdir',
  'stat',
  'lstat',
  'chmod',
  'rename',
  'rm',
  'touch',
  'readlink',
  'realpath',
  'mv',
  'cp',
  'readFile',
  'writeFile'
]
