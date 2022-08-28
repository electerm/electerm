
const { resolve } = require('path')
const cwd = process.cwd()

module.exports = {
  env: {
    ...process.env,
    NODE_TEST: 'yes'
  },
  args: [resolve(cwd, 'work/app')]
}
