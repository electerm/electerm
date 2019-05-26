/**
 * safe parse json
 */
export default str => {
  try {
    return JSON.parse(str)
  } catch (e) {
    log.error('JSON.parse fails', e.stack)
    return str
  }
}
