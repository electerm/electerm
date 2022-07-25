/**
 * language fix
 */

const _ = require('lodash')

module.exports = async () => {
  const lang = require('@electerm/electerm-locales/dist/en_us.js').lang
  return prefix => {
    return (id) => {
      return _.get(lang, `${prefix}.${id}`) || id
    }
  }
}
