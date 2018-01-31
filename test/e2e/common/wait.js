/**
 * wait async
 * @param {*} time
 */
module.exports = time => new Promise(resolve => setTimeout(resolve, time))
