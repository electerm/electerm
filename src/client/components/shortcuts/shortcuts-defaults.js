export default () => {
  return [
    {
      name: 'app_closeCurrentTab',
      shortcut: 'ctrl+w',
      shortcutMac: 'ctrl+w'
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
    {
      name: 'terminal_selectAll',
      shortcut: 'ctrl+a,ctrl+shift+a',
      shortcutMac: 'meta+a',
      readonly: true
    },
    {
      name: 'terminal_copy',
      shortcut: 'ctrl+c,ctrl+shift+c',
      shortcutMac: 'meta+c',
      readonly: true
    },
    {
      name: 'terminal_search',
      shortcut: 'ctrl+shift+f',
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
      shortcutMac: 'meta+ArrowUp'
    }
  ]
}
