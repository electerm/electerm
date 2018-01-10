/**
 * tab title create rule
 */
export default (res) => {
  let {host, port, username, title} = res
  let extra = host ? `${username}@${host}:${port}` : ''
  return title
    ? `${title}` + (extra ? ` - ${username}@${host}:${port}` : '')
    : extra
}
