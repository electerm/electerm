/**
 * tab title create rule
 */
export default (res) => {
  const { host, port, username, title, type } = res
  const extra = host ? `${username}@${host}:${port}` : ''
  let f = title
    ? `${title}` + (extra ? ` - ${username}@${host}:${port}` : '')
    : extra
  if (type) {
    f = `[${type}]${f}`
  }
  return f
}
