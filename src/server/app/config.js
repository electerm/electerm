
import {resolve} from 'path'

const p = resolve(
  process.cwd(),
  'package.json'
)
const pack = require(p)
const {
  port = 4570,
  host = 'localhost'
} = process.env

export default {
  port: parseInt(port),
  host,
  pack
}
