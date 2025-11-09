/**
 * serial port lib
 */

exports.listSerialPorts = async function () {
  try {
    const start = Date.now()
    const r = await require('serialport').SerialPort.list()
    const end = Date.now()
    if (end - start < 100) {
      await new Promise(resolve => setTimeout(resolve, 100)) // wait for 100ms to avoid potential issues on some platforms
    }
    return r
  } catch (error) {
    console.error('Error listing serial ports:', error)
    return Promise.resolve([]) // Return an empty array on error
  }
}
