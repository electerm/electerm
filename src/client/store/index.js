/**
 * central state store powered by manate - https://github.com/tylerlong/manate
 */

import { StateStore } from './store'
import { manage } from 'manate'

const store = manage(new StateStore())

export default store
