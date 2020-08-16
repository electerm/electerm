/**
 * extend client functions
 */
module.exports = (client) => {
  client.element = client.$
  client.elements = client.$$
  client.click = async (sel, n = 0) => {
    const sl = sel +
      (n ? `:nth-child(${n + 1})` : '')
    const s = await client.$(sl)
    await s.click()
  }
  client.hasFocus = async (sel, n = 0) => {
    const sl = sel +
      (n ? `:nth-child(${n + 1})` : '')
    const s = await client.$(sl)
    return s.isFocused()
  }
  client.getAttribute = async (sel, name) => {
    const s = await client.$(sel)
    return s.getAttribute(name)
  }
  client.getText = async (sel) => {
    const s = await client.$(sel)
    return s.getText()
  }
  client.setValue = async (sel, v) => {
    const s = await client.$(sel)
    return s.setValue(v)
  }
  client.getValue = async (sel) => {
    const s = await client.$(sel)
    return s.getValue()
  }
  client.rightClick = async function (sel, x, y) {
    const s = await client.$(sel)
    await s.click({
      button: 'right',
      x,
      y
    })
  }
  client.doubleClick = async function (sel, n = 0) {
    const sl = sel +
      (n ? `:nth-child(${n + 1})` : '')
    const s = await client.$(sl)
    await s.doubleClick()
  }
  return client
}
