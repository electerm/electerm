const delay = require('./wait')
const { expect } = require('./expect')

exports.basicTerminalTest = async (client, cmd) => {
  async function focus () {
    client.click('.session-current .term-wrap')
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

exports.getTerminalContent = async function (client) {
  await client.click('.session-current .term-wrap')
  await delay(300)
  await client.keyboard.press('Meta+A')
  await delay(300)
  await client.keyboard.press('Meta+C')
  await delay(300)
  const clipboardText = await client.readClipboard()
  await client.keyboard.press('Escape')
  await delay(300)
  return clipboardText
}
