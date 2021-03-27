
/**
 * windows drive D: should use D:\
 */
exports.isWinDrive = function (path) {
  return /^\w+:$/.test(path)
}
