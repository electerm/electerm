export default () => {
  return [
    {
      scope: 'app',
      title: 'close',
      func: 'store.close',
      shortcut: 'ctrl+w'
    },
    {
      scope: 'terminal',
      title: 'copy',
      shortcut: 'ctrl+c'
    },
    {
      scope: 'terminal',
      title: 'paste',
      shortcut: 'ctrl+v'
    },
    {
      scope: 'terminal',
      title: 'clear',
      shortcut: 'ctrl+l'
    },
    {
      scope: 'terminal',
      title: 'selectAll',
      shortcut: 'ctrl+a'
    },
    {
      scope: 'terminal',
      title: 'focus',
      shortcut: 'ctrl+shift+i'
    }
  ]
}
