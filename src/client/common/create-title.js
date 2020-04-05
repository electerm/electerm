/**
 * tab title create rule
 */
export default (res = {}) => {
  const {
    host, port, username, title, type,
    path
  } = res
  const fixTitle = `${username}@${host}:${port}`
  const extra = host || path ? (path || fixTitle) : ''
  let f = title
    ? `${title}` + (extra ? ` - ${extra}` : '')
    : extra
  if (type) {
    f = `[${type}]${f}`
  }
  return f
}
