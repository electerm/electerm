/**
 * safe parse json
 */
export default str => {
  try {
    return JSON.parse(str)
  } catch(e) {
    console.log(e.stack)
    return str
  }
}
