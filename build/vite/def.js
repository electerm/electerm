import { version } from './common.js'

export default {
  'process.env.VER': JSON.stringify(version),
  __DEFINES__: JSON.stringify('some value')
}
