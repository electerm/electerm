/**
 * safe parse json
 * @param {string} str
 * @param defaultValue value returned when parse fails or str is empty/null.
 *                     Falls back to the original str when not provided.
 */
export default (str, defaultValue) => {
  const hasDefault = defaultValue !== undefined
  if (str === '' || str == null) {
    return hasDefault ? defaultValue : str
  }
  try {
    return JSON.parse(str)
  } catch (e) {
    console.error('JSON.parse fails', e.stack)
    return hasDefault ? defaultValue : str
  }
}
