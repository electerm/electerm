const delay = require('./wait')
const { expect } = require('chai')
const extendClient = require('./client-extend')

module.exports = async (th, client, cmd) => {
  extendClient(client)
  async function rightClick () {
    client.rightClick('.ssh-wrap-show .xterm .xterm-cursor-layer', 20, 20)
  }
  async function focus () {
    client.click('.ssh-wrap-show .xterm .xterm-cursor-layer')
  }
  async function selectAll () {
    await rightClick()
    await delay(101)
    await client.click('.context-menu .context-item:nth-child(4)')
    await delay(101)
  }
  async function copy () {
    await selectAll()
    await rightClick()
    await client.click('.context-menu .context-item')
  }
  await copy()
  const text1 = await th.app.electron.clipboard.readText()
  await delay(101)
  await focus()
  await delay(1010)
  await client.keys([...cmd.split(''), 'Enter'])
  await delay(1011)
  await client.rightClick('.ssh-wrap-show .xterm canvas:nth-child(3)', 20, 20)

  await delay(1010)
  await copy()
  await delay(101)
  const text2 = await th.app.electron.clipboard.readText()
  expect(text1.trim().length).lessThan(text2.trim().length)
}
