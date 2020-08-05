/**
 * serial port lib
 */

exports.listSerialPorts = function () {
  return require('serialport').list()
}

exports.listSerialPorts().then(console.log)