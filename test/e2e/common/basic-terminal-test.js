const delay = require('./wait')
const { expect } = require('chai')

module.exports = async (th, client, cmd) => {
  await client.rightClick('.ssh-wrap-show .xterm canvas:nth-child(3)', 20, 20)

  await delay(101)
  await client.execute(function () {
    document.querySelectorAll('.context-menu .context-item')[3].click()
  })
  await client.rightClick('.ssh-wrap-show .xterm canvas:nth-child(3)', 20, 20)
  await delay(101)
  await client.execute(function () {
    document.querySelectorAll('.context-menu .context-item')[3].click()
  })
  await delay(101)
  await client.execute(function () {
    document.querySelectorAll('.context-menu .context-item')[0].click()
  })
  const text1 = await th.app.electron.clipboard.readText()
  await delay(101)
  await client.keys([...cmd.split(''), 'Enter'])
  await client.rightClick('.ssh-wrap-show .xterm canvas:nth-child(3)', 20, 20)

  await delay(101)
  await client.execute(function () {
    document.querySelectorAll('.context-menu .context-item')[3].click()
  })
  await client.rightClick('.ssh-wrap-show .xterm canvas:nth-child(3)', 20, 20)
  await delay(101)
  await client.execute(function () {
    document.querySelectorAll('.context-menu .context-item')[3].click()
  })
  await delay(101)
  await client.execute(function () {
    document.querySelectorAll('.context-menu .context-item')[0].click()
  })
  const text2 = await th.app.electron.clipboard.readText()
  expect(text1.trim().length).lessThan(text2.trim().length)
}
