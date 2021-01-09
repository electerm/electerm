/**
 * serial port lib
 */
// const SerialPort = require('serialport')
// const MockBinding = require('@serialport/binding-mock')

// SerialPort.Binding = MockBinding
// MockBinding.createPort('/dev/ROBOT', { echo: true, record: true })

exports.listSerialPorts = async function () {
  const arr = await require('serialport').list()
  return arr
}
