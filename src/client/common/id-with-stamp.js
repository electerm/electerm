/**
 * create id with time stamp
 */

import { nanoid } from 'nanoid/non-secure'
import dayjs from 'dayjs'

export default () => {
  return nanoid(7) + '_' + dayjs().format('YYYY-MM-DD-HH-mm-ss')
}
