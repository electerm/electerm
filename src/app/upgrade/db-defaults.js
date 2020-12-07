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

const defaultTheme = parsor(`
  main = #141314
  main-dark = #000
  main-light = #2E3338
  text = #ddd
  text-light = #fff
  text-dark = #888
  text-disabled = #777
  primary = #08c
  info = #FFD166
  success = #06D6A0
  error = #EF476F
  warn = #E55934
`)
const defaultThemeLight = parsor(`
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
const defaultThemeLightTerminal = parsor(`
foreground=#333333
background=#ededed
cursor=#b5bd68
cursorAccent=#1d1f21
selection=rgba(0, 0, 0, 0.3)
black=#575757
red=#FF2C6D
green=#19f9d8
yellow=#FFB86C
blue=#45A9F9
magenta=#FF75B5
cyan=#B084EB
white=#CDCDCD
brightBlack=#757575
brightRed=#FF2C6D
brightGreen=#19f9d8
brightYellow=#FFCC95
brightBlue=#6FC1FF
brightMagenta=#FF9AC1
brightCyan=#BCAAFE
brightWhite=#E6E6E6
`)

const defaultThemeTerminal = {
  foreground: '#bbbbbb',
  background: '#141314',
  cursor: '#b5bd68',
  cursorAccent: '#1d1f21',
  selection: 'rgba(255, 255, 255, 0.3)',
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

module.exports = exports.default = [
  {
    db: 'terminalThemes',
    data: [
      {
        _id: 'default',
        name: 'default',
        themeConfig: defaultThemeTerminal,
        uiThemeConfig: defaultTheme
      },
      {
        _id: 'defaultLight',
        name: 'default light',
        themeConfig: defaultThemeLightTerminal,
        uiThemeConfig: defaultThemeLight
      }
    ]
  },
  {
    db: 'bookmarkGroups',
    data: [
      {
        _id: 'default',
        title: 'default',
        bookmarkIds: [],
        bookmarkGroupIds: []
      }
    ]
  }
]
