const delay = require('./wait')
const { expect } = require('./expect')
const log = require('./log')
const diagnose = require('./diagnose')
const e = require('./lang')

// Terminal select-all/copy is platform specific: macOS uses meta (command),
// while on Linux there is no select-all keyboard binding in the terminal and
// plain ctrl+c would send SIGINT to the pty instead of copying. So on Linux
// select-all/copy go through the terminal context menu, which keeps every
// keystroke out of the pty.
//
// Gotcha: xterm's helper textarea follows the cursor, so a right-click can
// land on it and open the global *input* menu (Copy/Cut/Paste/Select all)
// instead of the terminal menu. Neutralize it for pointer events first, then
// right-click the center of the xterm canvas.
const isMac = process.platform === 'darwin'
const termScreenSel = '.session-current .xterm-screen'

async function prepareTerminalMenu (client) {
  await client.evaluate(() => {
    document.querySelectorAll('.session-current .xterm-helper-textarea').forEach((el) => {
      el.style.pointerEvents = 'none'
    })
  }).catch(() => {})
}

async function isTerminalMenuOpen (client) {
  try {
    return await client.evaluate((ids) => {
      const items = Array.from(
        document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item')
      ).map((d) => d.innerText || '')
      const text = items.join('\n')
      // terminal menu has Select all but never Cut; the input menu has both
      return text.includes(ids.selectAll) && !text.includes(ids.cut)
    }, { selectAll: e('selectall'), cut: e('cut') })
  } catch {
    return false
  }
}

async function openTerminalMenu (client, attempts = 3) {
  const dropdownSel = '.ant-dropdown:not(.ant-dropdown-hidden)'
  for (let i = 0; i < attempts; i++) {
    const s = client.locator(termScreenSel).first()
    await s.waitFor({ state: 'visible', timeout: 10000 })
    const box = await s.boundingBox()
    await s.click({
      button: 'right',
      position: {
        x: Math.floor(box.width / 2),
        y: Math.floor(box.height / 2)
      }
    })
    try {
      await client.locator(dropdownSel).first().waitFor({
        state: 'visible',
        timeout: 3000
      })
    } catch {
      continue
    }
    if (await isTerminalMenuOpen(client)) {
      return
    }
    await client.keyboard.press('Escape').catch(() => {})
    await delay(500)
  }
  await diagnose(client, 'terminal-menu')
  throw new Error('openTerminalMenu failed: terminal context menu did not open')
}

async function clickTerminalMenuItem (client, label) {
  await openTerminalMenu(client)
  await client.clickFirstVisible(
    `.ant-dropdown-menu-item:has-text("${label}")`,
    5000
  )
  await delay(401)
}

async function selectAllTerminal (client) {
  if (isMac) {
    await client.keyboard.press('Meta+A')
    await delay(401)
    return
  }
  await prepareTerminalMenu(client)
  await clickTerminalMenuItem(client, e('selectall'))
}

async function copyTerminal (client) {
  if (isMac) {
    await selectAllTerminal(client)
    await client.keyboard.press('Meta+C')
    await delay(401)
    return
  }
  await prepareTerminalMenu(client)
  await selectAllTerminal(client)
  await clickTerminalMenuItem(client, e('copy'))
}

exports.selectAllTerminal = selectAllTerminal

exports.basicTerminalTest = async (client, cmd) => {
  async function focus () {
    await client.click('.session-current .term-wrap')
  }
  async function readTerminal (retries = 5) {
    let text = ''
    for (let i = 0; i < retries; i++) {
      await copyTerminal(client)
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
    await copyTerminal(client)
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
