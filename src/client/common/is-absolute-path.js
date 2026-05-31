export default (path = '') => {
  return path.startsWith('/') || /^[a-zA-Z]:/.test(path) || path.startsWith('\\\\')
}
