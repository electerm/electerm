/**
 * time formatter
 */

const dayjs = require('dayjs')

module.exports = (
  time = new Date(),
  format = 'YYYY-MM-DD HH:mm:ss'
) => {
  return dayjs(time).format(format)
}
