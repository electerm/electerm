/**
 * wait async
 */
module.exports = function wait(time) {
  return new Promise(resolve => {
    setTimeout(resolve, time)
  })
}
