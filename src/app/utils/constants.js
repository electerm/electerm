/**
 * constants
 */

let {NODE_ENV} = process.env

export default {
  isDev: NODE_ENV === 'development',
  defaultLang: 'en_us'
}

