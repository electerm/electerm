/**
 * language fix
 */

const _ = require('lodash')

function capitalizeFirstLetter (string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

module.exports = async (electron) => {
  const { lang } = await electron.remote.getGlobal('et')
  return prefix => {
    return (id) => {
      return capitalizeFirstLetter(_.get(lang, `${prefix}.${id}`) || id)
    }
  }
}
