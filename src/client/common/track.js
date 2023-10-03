export default (eventName, value) => {
  if (!window.gtag) {
    return
  }
  log.debug('track data', eventName, value)
  window.gtag('event', eventName, value)
}
