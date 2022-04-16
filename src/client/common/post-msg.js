export default (msg) => {
  window.postMessage(msg, '*')
}
