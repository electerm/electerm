/**
 * safe parse json
 */
export default str => {
  if (str === '' || str == null) {
    return str
  }
  try {
    return JSON.parse(str)
  } catch (e) {
    console.error('JSON.parse fails', e.stack)
    return str
  }
}
