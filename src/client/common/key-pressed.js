/**
 * check if given key is pressed
 */

export default (e, key, type) => {
  const keyPressed = 'key' in e
    ? e.key.toLowerCase() === key.toLowerCase()
    : false
  const typeMatch = type
    ? e.type === type
    : true
  return typeMatch && keyPressed
}
