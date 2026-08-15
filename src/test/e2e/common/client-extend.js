/**
 * extend client functions
 */

const {
  expect
} = require('@playwright/test')
const delay = require('./wait')

module.exports = (client, app) => {
  client.element = (sel) => {
    return client.locator(sel).nth(0)
  }
  client.elements = (selector) => {
    return client.locator(selector)
  }
  client.click = async (sel, n = 0, parent) => {
    const sl = sel + ` >> nth=${n}`
    let s = client.locator(sl)
    if (parent) {
      s = s.locator('..')
    }
    await s.waitFor({ state: 'visible', timeout: 10000 })
    await s.click()
  }
  client.elemExist = async (sel) => {
    try {
      await client.locator(sel).waitFor({ timeout: 100 })
      return true
    } catch (error) {
      return false
    }
  }
  client.hasElem = async (sel, target = true) => {
    const s = client.locator(sel)
    const c = await s.count()
    expect(!!c).toEqual(target)
  }
  client.countElem = async (sel) => {
    const s = client.locator(sel)
    const c = await s.count()
    return c
  }
  client.hasFocus = async (sel) => {
    const s = await client.locator(sel).nth(0)
    expect(s).toBeFocused()
  }
  client.getValue = async (sel) => {
    const s = await client.locator(sel)
    return s.inputValue()
  }
  client.getText = async (sel) => {
    const s = await client.locator(sel).nth(0)
    return s.innerText()
  }
  client.setValue = async (sel, v) => {
    const s = client.locator(sel).first()
    return s.fill(v)
  }
  client.getAttribute = async (sel, name) => {
    const element = await client.locator(sel).nth(0)
    return element.getAttribute(name)
  }
  client.rightClick = async function (sel, x, y) {
    const s = client.locator(sel).first()
    await s.waitFor({ state: 'visible', timeout: 10000 })
    await s.click({
      button: 'right',
      position: {
        x,
        y
      }
    })
  }
  client.doubleClick = async function (sel, n = 0) {
    const sl = sel + `>> nth=${n}`
    const s = client.locator(sl).first()
    await s.waitFor({ state: 'visible', timeout: 10000 })
    await s.dblclick()
  }
  // Right-click to open an Ant Design context menu (trigger: ['contextMenu'])
  // and wait for the dropdown to actually become visible. Retries the
  // right-click when the menu fails to open, which hardens against the
  // intermittent race where the contextmenu event is missed during a
  // re-render / open animation.
  client.openContextMenu = async function (sel, x = 30, y = 20, retries = 3) {
    const dropdownSel = '.ant-dropdown:not(.ant-dropdown-hidden)'
    for (let i = 0; i < retries; i++) {
      await client.rightClick(sel, x, y)
      try {
        await client.locator(dropdownSel).first().waitFor({
          state: 'visible',
          timeout: 2000
        })
        return
      } catch (e) {
        // The context menu did not open in time; retry the right click.
      }
    }
    // Final attempt: let the caller's menu-item click surface a clear error
    // if the dropdown still fails to appear.
    await client.rightClick(sel, x, y)
  }
  client.readClipboard = async () => {
    return app.evaluate(async ({ clipboard }) => clipboard.readText())
  }
  client.writeClipboard = async (clipboardContentToWrite) => {
    await app.evaluate(async ({ clipboard }, text) => {
      await clipboard.writeText(text)
    }, clipboardContentToWrite)
  }
  client.getAttribute = async (sel, name) => {
    return client.$eval(sel, (e, name) => {
      return e.getAttribute(name)
    }, name)
  }
  client.hover = async (sel) => {
    const element = await client.locator(sel).nth(0)
    await element.hover()
    await delay(400)
  }

  return client
}
