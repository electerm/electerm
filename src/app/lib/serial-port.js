/**
 * serial port lib
 */

// const SerialPort = require('@serialport/stream')
// const MockBinding = require('@serialport/binding-mock')
// SerialPort.Binding = MockBinding
// // Create a port and enable the echo and recording.
// MockBinding.createPort('/dev/ROBOT', { echo: true, record: true })

exports.listSerialPorts = async function () {
  const arr = await require('serialport').list()
  return arr
}
