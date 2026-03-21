const path = require('path')
const { downloadPackage } = require('./npm')

exports.customRequire = async (moduleName, options = {}) => {
  const customModulesFolderPath = options.customModulesFolderPath ||
    process.env.CUSTOM_MODULES_FOLDER_PATH ||
    path.resolve(require('../common/app-props').appPath, 'electerm', 'custom-modules')
  const isCustomModule = options.isCustomModule || false
  const downloadModule = options.downloadModule !== false

  const modulePath = path.join(customModulesFolderPath, 'node_modules', moduleName)

  if (isCustomModule) {
    try {
      return require(modulePath)
    } catch (err) {
      if (!downloadModule) {
        throw err
      }
      await downloadPackage(moduleName, customModulesFolderPath)
      return require(modulePath)
    }
  }

  try {
    return require(moduleName)
  } catch (err) {
    if (!downloadModule) {
      throw err
    }

    await downloadPackage(moduleName, customModulesFolderPath)
    return require(modulePath)
  }
}
