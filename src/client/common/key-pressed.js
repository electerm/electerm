/**
 * check if given key is pressed
 */

export default (e, key) => {
  return 'key' in e ? e.key.toLowerCase() === key.toLowerCase() : false
}
