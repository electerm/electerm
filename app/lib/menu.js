/**
 * app system menu config
 */
const {app, Menu} = require('electron')
const version = require('./version')
let tag = version.includes('-')
  ? version.split('-')[0]
  : ''
let baseUrl = 'https://github.com/electerm/electerm/releases'
let realeaseUrl = tag
  ? `${baseUrl}/tag/v${tag}`
  : baseUrl
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
          require('electron')
            .shell
            .openExternal(realeaseUrl)
        }
      },
      {
        label: 'report issue',
        click () {
          require('electron')
            .shell
            .openExternal('https://github.com/electerm/electerm/issues/new')
        }
      },
      {
        label: 'github',
        click () {
          require('electron')
            .shell
            .openExternal('https://github.com/electerm/electerm')
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
