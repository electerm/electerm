/**
 * serial port lib
 */

exports.listSerialPorts = function () {
  try {
    return require('serialport').SerialPort.list()
  } catch (error) {
    console.error('Error listing serial ports:', error)
    return Promise.resolve([]) // Return an empty array on error
  }
}
