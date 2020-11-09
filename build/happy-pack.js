require('dotenv').config()
const os = require('os')
const HappyPack = require('happypack')
const { env } = process
const packThreadCount = env.packThreadCount
  ? parseInt(env.packThreadCount)
  : os.cpus().length
const happyThreadPool = packThreadCount === 0
  ? null
  : HappyPack.ThreadPool({ size: packThreadCount })
const happyConf = {
  loaders: ['babel-loader'],
  threadPool: happyThreadPool,
  verbose: true
}
exports.happy = packThreadCount === 0 ? null : new HappyPack(happyConf)
exports.packThreadCount = packThreadCount
