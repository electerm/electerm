export default () => {
  return [
    {
      name: 'app_closeCurrentTab',
      shortcut: 'alt+w',
      shortcutMac: 'alt+w'
    },
    {
      name: 'app_mouseWheelDownCloseTab',
      shortcut: 'mouseWheel',
      shortcutMac: 'mouseWheel',
      readonly: true
    },
    {
      name: 'app_reloadCurrentTab',
      shortcut: 'alt+r',
      shortcutMac: 'alt+r'
    },
    {
      name: 'app_cloneToNextLayout',
      shortcut: 'ctrl+/',
      shortcutMac: 'meta+/'
    },
    {
      name: 'app_newBookmark',
      shortcut: 'ctrl+n',
      shortcutMac: 'meta+n'
    },
    {
      name: 'app_togglefullscreen',
      shortcut: 'alt+f',
      shortcutMac: 'alt+f'
    },
    {
      name: 'app_zoomin',
      shortcut: 'ctrl+=',
      shortcutMac: 'meta+='
    },
    {
      name: 'app_zoomout',
      shortcut: 'ctrl+-',
      shortcutMac: 'meta+-'
    },
    {
      name: 'app_prevTab',
      shortcut: 'ctrl+shift+tab',
      shortcutMac: 'ctrl+shift+tab'
    },
    {
      name: 'app_nextTab',
      shortcut: 'ctrl+tab',
      shortcutMac: 'ctrl+tab'
    },
    {
      name: 'terminal_clear',
      shortcut: 'ctrl+l,ctrl+shift+l',
      shortcutMac: 'meta+l'
    },
    // {
    //   name: 'terminal_selectAll',
    //   shortcut: 'ctrl+a,ctrl+shift+a',
    //   shortcutMac: 'meta+a',
    //   skipMac: true,
    //   readonly: true
    // },
    {
      name: 'terminal_copy',
      shortcut: 'ctrl+c,ctrl+shift+c',
      shortcutMac: 'meta+c',
      skipMac: true,
      readonly: true
    },
    {
      name: 'terminal_paste',
      shortcut: 'ctrl+v,ctrl+shift+v',
      shortcutMac: 'meta+v',
      readonly: true
    },
    {
      name: 'terminal_search',
      shortcut: 'ctrl+f',
      shortcutMac: 'meta+f'
    },
    {
      name: 'terminal_pasteSelected',
      shortcut: 'alt+insert',
      shortcutMac: 'alt+insert'
    },
    {
      name: 'terminal_showNormalBuffer',
      shortcut: 'ctrl+ArrowUp',
      shortcutMac: 'meta+↑'
    },
    {
      name: 'terminal_zoominTerminal',
      shortcut: 'ctrl+▲',
      shortcutMac: 'meta+▲'
    },
    {
      name: 'terminal_zoomoutTerminal',
      shortcut: 'ctrl+▼',
      shortcutMac: 'meta+▼'
    }
  ]
}
