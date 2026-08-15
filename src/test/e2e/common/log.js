module.exports = (...arg) => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}]  >`, ...arg)
}
