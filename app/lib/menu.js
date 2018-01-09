/**
 * app system menu config
 */
const {app, Menu, shell} = require('electron')
let {NODE_ENV} = process.env
const isDev = NODE_ENV === 'development'
const packInfo = require(isDev ? '../../package.json' : '../package.json')

const template = [
  {
    label: 'Edit',
    submenu: [
      {role: 'undo'},
      {role: 'redo'},
      {type: 'separator'},
      {role: 'cut'},
      {role: 'copy'},
      {role: 'paste'},
      {role: 'pasteandmatchstyle'},
      {role: 'delete'},
      {role: 'selectall'}
    ]
  },
  {
    label: 'View',
    submenu: [
      {role: 'reload'},
      {role: 'forcereload'},
      {role: 'toggledevtools'},
      {type: 'separator'},
      {role: 'resetzoom'},
      {role: 'zoomin'},
      {role: 'zoomout'},
      {type: 'separator'},
      {role: 'togglefullscreen'}
    ]
  },
  {
    role: 'window',
    submenu: [
      {role: 'minimize'},
      {role: 'close'}
    ]
  },
  {
    role: 'help',
    label: 'help',
    submenu: [
      {
        label: 'about',
        click () {
          require('./win').win.webContents.send('open-about', null)
        }
      },
      {
        label: 'check update',
        click() {
          require('./win').win.webContents.send('checkupdate', null)
        }
      },
      {
        label: 'report issue',
        click () {
          shell
            .openExternal('https://github.com/electerm/electerm/issues/new')
        }
      },
      {
        label: 'github',
        click () {
          shell
            .openExternal('https://github.com/electerm/electerm')
        }
      },
      {
        label: 'homepage',
        click () {
          shell
            .openExternal(packInfo.homepage)
        }
      }
    ]
  }
]

if (process.platform === 'darwin') {
  template.unshift({
    label: app.getName(),
    submenu: [
      {role: 'about'},
      {type: 'separator'},
      {role: 'services', submenu: []},
      {type: 'separator'},
      {role: 'hide'},
      {role: 'hideothers'},
      {role: 'unhide'},
      {type: 'separator'},
      {role: 'quit'}
    ]
  })

  // Edit menu
  template[1].submenu.push(
    {type: 'separator'},
    {
      label: 'Speech',
      submenu: [
        {role: 'startspeaking'},
        {role: 'stopspeaking'}
      ]
    }
  )

  // Window menu
  template[3].submenu = [
    {role: 'close'},
    {role: 'minimize'},
    {role: 'zoom'},
    {type: 'separator'},
    {role: 'front'}
  ]
}

const menu = Menu.buildFromTemplate(template)

module.exports = menu
