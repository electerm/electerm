/**
 * app system menu config
 */
const {
  app,
  Menu,
  shell
} = require('electron')
const { packInfo } = require('../common/runtime-constants')
const globalState = require('./glob-state')
const { getFocusedWindow, getWindows, setCloseAction } = require('./window-manager')

function sendToFocusedWindow (channel) {
  getFocusedWindow()?.webContents.send(channel, null)
}

function createNewWindow () {
  return require('./create-window').createWindow(globalState.get('config'))
}

function buildMenu () {
  const e = globalState.get('translate')

  const template = [
    {
      label: e('edit'),
      submenu: [
        {
          label: e('newWindow'),
          accelerator: 'CmdOrCtrl+N',
          click: createNewWindow
        },
        {
          label: e('newBookmark'),
          click () {
            sendToFocusedWindow('new-ssh', null)
          }
        },
        {
          role: 'undo',
          label: e('undo')
        },
        {
          role: 'redo',
          label: e('redo')
        },
        {
          type: 'separator'
        },
        {
          role: 'cut',
          label: e('cut')
        },
        {
          role: 'copy',
          label: e('copy'),
          accelerator: 'CmdOrCtrl+C'
        },
        {
          role: 'paste',
          label: e('paste'),
          accelerator: 'CmdOrCtrl+V'
        },
        {
          role: 'pasteandmatchstyle',
          label: e('pasteandmatchstyle')
        },
        {
          role: 'delete',
          label: e('del')
        },
        {
          label: e('selectall'),
          accelerator: 'CmdOrCtrl+A',
          click () {
            sendToFocusedWindow('selectall', null)
          }
        },
        {
          type: 'separator'
        },
        {
          label: e('settings'),
          click () {
            sendToFocusedWindow('openSettings', null)
          }
        }
      ]
    },
    {
      label: e('view'),
      submenu: [
        {
          role: 'forcereload',
          label: e('forcereload')
        },
        {
          role: 'toggledevtools',
          label: e('toggledevtools')
        },
        {
          type: 'separator'
        },
        {
          click () {
            sendToFocusedWindow('zoom-reset', null)
          },
          label: e('resetzoom')
        },
        {
          click () {
            sendToFocusedWindow('zoomin', null)
          },
          label: e('zoomin')
        },
        {
          click () {
            sendToFocusedWindow('zoomout', null)
          },
          label: e('zoomout')
        },
        {
          type: 'separator'
        },
        {
          role: 'togglefullscreen',
          label: e('togglefullscreen')
        }
      ]
    },
    {
      role: 'window',
      label: e('window'),
      submenu: [
        {
          role: 'minimize',
          label: e('minimize')
        },
        {
          label: e('maximize'),
          click () {
            getFocusedWindow().maximize()
          }
        },
        {
          label: e('restart'),
          click () {
            getWindows().forEach(win => setCloseAction(win, ''))
            app.relaunch()
            app.quit()
          }
        }
      ]
    },
    {
      role: 'help',
      label: e('help'),
      submenu: [
        {
          label: e('about'),
          click () {
            sendToFocusedWindow('open-about', null)
          }
        },
        {
          label: e('checkUpdate'),
          click () {
            sendToFocusedWindow('checkupdate', null)
          }
        },
        {
          label: e('reportIssue'),
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
          label: e('homepage'),
          click () {
            shell
              .openExternal(packInfo.homepage)
          }
        },
        {
          label: e('toggledevtools'),
          click () {
            getFocusedWindow().webContents.openDevTools()
          }
        }
      ]
    }
  ]

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        {
          role: 'services',
          submenu: []
        },
        {
          type: 'separator'
        },
        {
          role: 'hide',
          label: e('hide')
        },
        {
          role: 'hideothers',
          label: e('hideothers')
        },
        {
          role: 'unhide',
          label: e('unhide')
        },
        {
          type: 'separator'
        },
        {
          role: 'quit',
          label: e('quit')
        }
      ]
    })

    template[2].submenu = template[2].submenu
      .filter(d => d.role !== 'togglefullscreen')

    // Edit menu
    template[1].submenu.push({
      type: 'separator'
    }, {
      label: 'Speech',
      submenu: [
        {
          role: 'startspeaking',
          label: e('startspeaking')
        },
        {
          role: 'stopspeaking',
          label: e('stopspeaking')
        }
      ]
    })

    // Window menu
    template[3].submenu = [
      ...template[3].submenu,
      {
        role: 'zoom',
        label: e('zoom')
      },
      {
        type: 'separator'
      },
      {
        role: 'front',
        label: e('front')
      }
    ]

    const dockMenuTemplate = [
      {
        label: e('newWindow'),
        click: createNewWindow
      }
    ]
    const dockMenu = Menu.buildFromTemplate(dockMenuTemplate)
    app.dock.setMenu(dockMenu)
  }

  const menu = Menu.buildFromTemplate(template)
  return menu
}

module.exports = buildMenu
