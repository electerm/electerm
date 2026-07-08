/**
 * Ensure remote path always starts with /
 * Windows drive letters like c: become /c:
 * Also fixes mixed separators like /c:\windows → /c:/windows
 * This is needed because SFTP protocol expects paths with leading /
 * @param {String} path
 * @return {String}
 */
export default function normalizeRemotePath (path) {
  if (!path) return path
  // Fix mixed separators: /c:\windows → /c:/windows
  if (/^\/[a-zA-Z]:\\/.test(path)) {
    path = path.replace(/\\/g, '/')
  } else if (/^[a-zA-Z]:/.test(path)) {
    // Add leading / to bare drive letters: c: → /c:, c:\windows → /c:/windows
    path = '/' + path.replace(/\\/g, '/')
  }
  // Strip trailing slashes except for root path "/"
  if (path.length > 1 && path.endsWith('/')) {
    path = path.replace(/\/+$/, '')
  }
  return path
}
