/**
 * central state store powered by subx - https://github.com/tylerlong/subx
 */

import Subx from 'subx'
import initState from './init-state'
import loadDataExtend from './load-data'
import dbUpgradeExtend from './db-upgrade'
import eventExtend from './event'
import watchExtend from './watch'
import syncExtend from './sync'
import appUpgrdeExtend from './app-upgrade'
import bookmarkGroupExtend from './bookmark-group'
import bookmarkExtend from './bookmark'
import commonExtend from './common'
import contextMenuExtend from './context-menu'
import itemExtend from './item'
import quickCommandExtend from './quick-command'
import sessionExtend from './session'
import settingExtend from './setting'
import sidebarExtend from './sidebar'
import sysMenuExtend from './system-menu'
import tabExtend from './tab'
import terminalThemeExtend from './terminal-theme'
import transferHistoryExtend from './transfer-history'

const store = Subx.create(initState)
console.log(store)
loadDataExtend(store)
eventExtend(store)
dbUpgradeExtend(store)
syncExtend(store)
appUpgrdeExtend(store)
bookmarkGroupExtend(store)
bookmarkExtend(store)
commonExtend(store)
contextMenuExtend(store)
itemExtend(store)
quickCommandExtend(store)
sessionExtend(store)
settingExtend(store)
sidebarExtend(store)
sysMenuExtend(store)
tabExtend(store)
terminalThemeExtend(store)
transferHistoryExtend(store)
watchExtend(store)

export default store
