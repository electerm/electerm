/**
 * time formatter
 */

import dayjs from 'dayjs'

export default (
  time = new Date(),
  format = 'YYYY-MM-DD HH:mm:ss'
) => {
  return dayjs(time).format(format)
}
