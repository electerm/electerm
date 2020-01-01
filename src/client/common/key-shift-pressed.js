/**
 * check if shift key is pressed
 */

export default e => {
  return 'shiftKey' in e ? e.shiftKey : false
}
