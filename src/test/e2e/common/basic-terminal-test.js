const delay = require('./wait')
const { expect } = require('./expect')
const log = require('./log')
const diagnose = require('./diagnose')

exports.basicTerminalTest = async (client, cmd) => {
  async function focus () {
    await client.click('.session-current .term-wrap')
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
  async function readTerminal (retries = 5) {
    let text = ''
    for (let i = 0; i < retries; i++) {
      await copy()
      await delay(101)
      text = await client.readClipboard()
      if (text && text.trim().length > 0) {
        break
      }
      await delay(1000)
    }
    return text
  }
  const text1 = await readTerminal()
  await delay(301)
  await focus()
  await delay(1010)
  // Re-focus and verify keystrokes land in the terminal:
  // if focus was lost (modal, wrong pane), typing would go nowhere
  // and the second copy would come back empty.
  await focus()
  await delay(500)
  await client.keyboard.type(cmd)
  await client.keyboard.press('Enter')
  // Command output over SSH can be slow; poll until content grows
  // instead of asserting on a single fixed-delay snapshot.
  const len1 = text1.trim().length
  let text2 = ''
  const start = Date.now()
  while (Date.now() - start < 20000) {
    await delay(1500)
    text2 = await readTerminal(2)
    if (text2.trim().length > len1) {
      break
    }
  }
  log(`[basicTerminalTest] len1=${len1} len2=${text2.trim().length} cmd=${cmd}`)
  if (!(len1 < text2.trim().length)) {
    await diagnose(client, `terminal-${cmd}`)
  }
  expect(len1).lessThan(text2.trim().length)
}

exports.getTerminalContent = async function (client, retries = 5) {
  for (let i = 0; i < retries; i++) {
    await client.click('.session-current .term-wrap')
    await delay(300)
    await client.keyboard.press('Meta+A')
    await delay(300)
    await client.keyboard.press('Meta+C')
    await delay(300)
    const clipboardText = await client.readClipboard()
    await client.keyboard.press('Escape')
    await delay(300)
    if (clipboardText && clipboardText.trim().length > 0) {
      return clipboardText
    }
    await delay(1000)
  }
  return ''
}
