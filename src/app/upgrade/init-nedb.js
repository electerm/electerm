/**
 * for new user, they do not have old json db
 * just need init db
 */

const { dbAction } = require('../lib/nedb')
const log = require('../utils/log')

async function initData () {
  log.info('start: init db')
  await dbAction('bookmarkGroups', 'insert', {
    _id: 'default',
    title: 'default'
  })
  await dbAction('terminalThemes', 'insert', {
    _id: 'default',
    name: 'default',
    themeConfig: {
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
  })
  log.info('end: init db')
}

module.exports = initData
