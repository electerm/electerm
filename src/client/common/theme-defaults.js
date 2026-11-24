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
main-dark=#151515
main-light=#343434
text=#e4e4e4
text-light=#fff
text-dark=#b1b1b1
text-disabled=#737373
primary=#58aeea
info=#FFD166
success=#06D6A0
error=#EF476F
warn=#E55934
main=#222222
  `)
}
const defaultThemeLightFunc = () => {
  return parsor(`
      main=#f6f7f8
      main-dark=#e3e7eb
      main-light=#ffffff
      text=#26323b
      text-light=#18242e
      text-dark=#52616e
      text-disabled=#767e86
      primary=#176693
      info=#84641a
      success=#187447
      error=#b23838
      warn=#a55517
    `)
}

// The terminal palette is independent of the light/dark window chrome.
const mobaTerminal = () => {
  return {
    foreground: '#ececec',
    background: '#1e1e1e',
    cursor: '#b4b4c0',
    cursorAccent: '#1e1e1e',
    selectionBackground: 'rgba(200, 200, 200, 0.6)',
    black: '#1e1e1e',
    red: '#ff6060',
    green: '#0eb16c',
    yellow: '#bebe12',
    blue: '#1296be',
    magenta: '#ff4dff',
    cyan: '#54ccef',
    white: '#cccccc',
    brightBlack: '#808080',
    brightRed: '#ff8080',
    brightGreen: '#18ed93',
    brightYellow: '#dedc12',
    brightBlue: '#1bbae9',
    brightMagenta: '#ff7dff',
    brightCyan: '#8eddf4',
    brightWhite: '#cccccc'
  }
}

export const defaultThemeId = 'default'
export const defaultThemeLightId = 'defaultLight'

export function defaultTheme () {
  return {
    id: defaultThemeId,
    name: 'default',
    themeConfig: mobaTerminal(),
    uiThemeConfig: defaultThemeDark()
  }
}

export function defaultThemeLight () {
  return {
    id: defaultThemeLightId,
    name: 'default light',
    themeConfig: mobaTerminal(),
    uiThemeConfig: defaultThemeLightFunc()
  }
}
