export default () => {
  return [
    {
      name: 'app.closeCurrentTab',
      shortcut: 'ctrl+w',
      shortcutMac: 'ctrl+w'
    },
    {
      name: 'app.prevTab',
      shortcut: 'ctrl+shift+tab',
      shortcutMac: 'ctrl+shift+tab'
    },
    {
      name: 'app.nextTab',
      shortcut: 'ctrl+tab',
      shortcutMac: 'ctrl+tab'
    },
    {
      name: 'terminal.clear',
      shortcut: 'ctrl+l,ctrl+shift+l',
      shortcutMac: 'meta+l'
    },
    {
      name: 'terminal.selectAll',
      shortcut: 'ctrl+a,ctrl+shift+a',
      shortcutMac: 'meta+a',
      readonly: true
    },
    {
      name: 'terminal.copy',
      shortcut: 'ctrl+c,ctrl+shift+c',
      shortcutMac: 'meta+c',
      readonly: true
    },
    {
      name: 'terminal.search',
      shortcut: 'ctrl+shift+f',
      shortcutMac: 'meta+f'
    },
    {
      name: 'terminal.pasteSelected',
      shortcut: 'alt+insert',
      shortcutMac: 'alt+insert'
    },
    {
      name: 'terminal.showNormalBuffer',
      shortcut: 'ctrl+ArrowUp',
      shortcutMac: 'meta+ArrowUp'
    }
  ]
}
