/**
 * central state store powered by manate - https://github.com/tylerlong/manate
 */

import { Store } from './store'
import { manage } from 'manate'

const store = manage(new Store())

export default store
