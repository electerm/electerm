const { dbAction } = require('./db')
const defaultSetting = require('../common/config-default')
const getPort = require('./get-port')
const { userConfigId, userNoEncryptConfigId } = require('../common/constants')
const generate = require('../common/uid')
const globalState = require('./glob-state')

// `pasteWhenContextMenu` (boolean) was replaced by `rightClickBehavior`
// ('context' | 'paste' | 'passthrough'). Configs saved by an older version
// still carry the boolean, so translate it once here — where the stored
// config first meets the defaults — and drop the dead key so the next save
// does not write it back.
function migrateRightClickBehavior (userConfig) {
  if (userConfig.rightClickBehavior === undefined) {
    userConfig.rightClickBehavior = userConfig.pasteWhenContextMenu
      ? 'paste'
      : defaultSetting.rightClickBehavior
  }
  delete userConfig.pasteWhenContextMenu
}

// `bookmarkBar` is a new entry in `leftSideBarIcons`, and the icon bar renders
// exactly what that list names — so a config saved before the icon existed has
// no way to show it. Insert it once, next to the bookmarks icon it belongs
// with. The `bookmarkBarIconSeeded` marker is what makes this a one-shot: a
// user who removes the icon afterwards keeps it removed, because the marker is
// saved along with the list they edited.
function migrateLeftSideBarIcons (userConfig) {
  if (userConfig.bookmarkBarIconSeeded) {
    return
  }
  userConfig.bookmarkBarIconSeeded = true
  const icons = userConfig.leftSideBarIcons
  if (!Array.isArray(icons) || icons.includes('bookmarkBar')) {
    return
  }
  const index = icons.indexOf('bookmarks')
  icons.splice(index === -1 ? icons.length : index + 1, 0, 'bookmarkBar')
}

exports.getConfig = async (inited) => {
  const userConfig = await dbAction('data', 'findOne', {
    _id: userConfigId
  }) || {}
  const requireAuth = userConfig.hashedPassword
  delete userConfig._id
  delete userConfig.host
  delete userConfig.terminalTypes
  delete userConfig.tokenElecterm
  delete userConfig.hashedPassword
  delete userConfig.salt
  migrateRightClickBehavior(userConfig)
  migrateLeftSideBarIcons(userConfig)
  const port = inited
    ? globalState.get('config').port
    : await getPort()
  const config = {
    ...defaultSetting,
    ...userConfig,
    requireAuth,
    port,
    tokenElecterm: inited ? globalState.get('config').tokenElecterm : generate()
  }
  return {
    userConfig,
    config
  }
}

exports.getDbConfig = async () => {
  const userConfig = await dbAction('data', 'findOne', {
    _id: userConfigId
  }) || {}
  return userConfig
}

exports.getUserConfigNoEnc = async () => {
  const userConfig = await dbAction('data', 'findOne', {
    _id: userNoEncryptConfigId
  }) || {}
  return userConfig
}
