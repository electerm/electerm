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
const isMac = process.platform === 'darwin'

async function dumpTermMenuState (client, tag) {
  try {
    const info = await client.evaluate(() => {
      const items = Array.from(
        document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item')
      ).map((d) => ({
        text: (d.innerText || '').slice(0, 30),
        disabled: d.getAttribute('aria-disabled'),
        cls: (d.className || '').slice(0, 80)
      }))
      const el = document.elementFromPoint(640, 500)
      return {
        openMenus: document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden)').length,
        selLayer: document.querySelectorAll('.session-current .xterm-selection').length,
        selTextLen: (() => {
          try {
            const n = document.querySelector('.session-current .xterm-selection')
            return n ? (n.textContent || '').length : -1
          } catch { return -2 }
        })(),
        termWraps: document.querySelectorAll('.session-current .term-wrap').length,
        atPoint: el ? `${el.tagName}.${String(el.className || '').slice(0, 100)}` : null,
        items
      }
    })
    log(`[termmenu:${tag}]`, JSON.stringify(info).slice(0, 1500))
  } catch (e) {
    log(`[termmenu:${tag}] dump failed:`, String((e && e.message) || e).slice(0, 120))
  }
}

// TEMP-DEBUG: right-click the center of the xterm canvas instead of term-wrap corner
async function openTerminalMenu (client, itemText) {
  const box = await client.locator('.session-current .xterm-screen').first().boundingBox()
  log('[termmenu:bbox]', JSON.stringify(box))
  const s = client.locator('.session-current .xterm-screen').first()
  await s.waitFor({ state: 'visible', timeout: 10000 })
  await s.click({
    button: 'right',
    position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) }
  })
  await client.locator('.ant-dropdown:not(.ant-dropdown-hidden)').first().waitFor({
    state: 'visible',
    timeout: 5000
  })
  await dumpTermMenuState(client, `opened-for-${itemText}`)
}

async function selectAllTerminal (client) {
  if (isMac) {
    await client.keyboard.press('Meta+A')
    await delay(401)
    return
  }
  await openTerminalMenu(client, 'selectall')
  await client.clickFirstVisible(
    `.ant-dropdown-menu-item:has-text("${e('selectall')}")`,
    2500
  )
  await delay(401)
  await dumpTermMenuState(client, 'after-select-all')
}

async function copyTerminal (client) {
  if (isMac) {
    await selectAllTerminal(client)
    await client.keyboard.press('Meta+C')
    await delay(401)
    return
  }
  await selectAllTerminal(client)
  // Open the menu once more just to observe Copy enabled-state, then close it
  await openTerminalMenu(client, 'copy-observe')
  await dumpTermMenuState(client, 'before-copy')
  await client.keyboard.press('Escape').catch(() => {})
  await delay(300)
  await openTerminalMenu(client, 'copy')
  await client.clickFirstVisible(
    `.ant-dropdown-menu-item:has-text("${e('copy')}")`,
    2500
  )
  await delay(401)
}

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
