/**
 * database default should init
 */

function parsor (themeTxt) {
  return themeTxt.split('\n').reduce((prev, line) => {
    let [key = '', value = ''] = line.split('=')
    key = key.trim()
    value = value.trim()
    if (!key || !value) {
      return prev
    }
    prev[key] = value
    return prev
  }, {})
}

const defaultThemeDark = () => {
  return parsor(`
main-dark=#000
main-light=#2E3338
text=#ddd
text-light=#fff
text-dark=#888
text-disabled=#777
primary=#08c
info=#FFD166
success=#06D6A0
error=#EF476F
warn=#E55934
main=#121214
  `)
}
const defaultThemeLightFunc = () => {
  return parsor(`
      main=#ededed
      main-dark=#cccccc
      main-light=#fefefe
      text=#555
      text-light=#777
      text-dark=#444
      text-disabled=#888
      primary=#08c
      info=#FFD166
      success=#06D6A0
      error=#EF476F
      warn=#E55934
    `)
}

const defaultThemeLightTerminal = () => {
  return parsor(`
background=#121214
foreground=#af9a91
cursor=#af9a91
selectionBackground=#575256
cursorAccent=#121214
black=#572100
red=#ba3934
green=#91773f
yellow=#b55600
blue=#5f63b4
magenta=#a17c7b
cyan=#8faea9
white=#af9a91
brightBlack=#4e4b61
brightRed=#d9443f
brightGreen=#d6b04e
brightYellow=#f66813
brightBlue=#8086ef
brightMagenta=#e2c2bb
brightCyan=#a4dce7
brightWhite=#d2c7a9
    `
  )
}

const defaultThemeDarkTerminal = () => {
  return {
    foreground: '#bbbbbb',
    background: '#20111b',
    cursor: '#b5bd68',
    cursorAccent: '#1d1f21',
    selectionBackground: 'rgba(255, 255, 255, 0.3)',
    black: '#575757',
    red: '#FF2C6D',
    green: '#19f9d8',
    yellow: '#FFB86C',
    blue: '#45A9F9',
    magenta: '#FF75B5',
    cyan: '#B084EB',
    white: '#CDCDCD',
    brightBlack: '#757575',
    brightRed: '#FF2C6D',
    brightGreen: '#19f9d8',
    brightYellow: '#FFCC95',
    brightBlue: '#6FC1FF',
    brightMagenta: '#FF9AC1',
    brightCyan: '#BCAAFE',
    brightWhite: '#E6E6E6'
  }
}

export function defaultTheme () {
  return {
    id: 'default',
    name: 'default',
    themeConfig: defaultThemeDarkTerminal(),
    uiThemeConfig: defaultThemeDark()
  }
}

export function defaultThemeLight () {
  return {
    id: 'defaultLight',
    name: 'default light',
    themeConfig: defaultThemeLightTerminal(),
    uiThemeConfig: defaultThemeLightFunc()
  }
}
