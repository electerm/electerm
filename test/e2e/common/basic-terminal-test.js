const delay = require('./wait')
const { expect } = require('chai')

module.exports = async (client, cmd) => {
  async function focus () {
    client.click('.session-current .xterm .xterm-cursor-layer')
  }
  async function selectAll () {
    await client.keyboard.press('Meta+A')
    await delay(401)
  }
  async function copy () {
    await selectAll()
    await client.keyboard.press('Meta+C')
    await delay(401)
  }
  await copy()
  const text1 = await client.readClipboard()
  await delay(301)
  await focus()
  await delay(1010)
  await client.keyboard.type(cmd)
  await client.keyboard.press('Enter')
  await delay(1011)
  await copy()
  await delay(101)
  const text2 = await client.readClipboard()
  expect(text1.trim().length).lessThan(text2.trim().length)
}
