
exports.createDockMenu = function (prefix) {
  const e = prefix('menu')
  return require('electron').Menu.buildFromTemplate([
    {
      label: e('newWindow'),
      click () {
        global.win.webContents.send('new-window', null)
      }
    }
  ])
}
