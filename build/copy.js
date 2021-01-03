const CopyWebpackPlugin = require('copy-webpack-plugin')
const { resolve } = require('path')
const from = resolve(
  __dirname,
  '../node_modules/@electerm/electerm-resource/tray-icons'
)
const from0 = resolve(
  __dirname,
  '../node_modules/vscode-icons/icons'
)
const from1 = resolve(
  __dirname,
  '../node_modules/react/umd/react.production.min.js'
)
const from2 = resolve(
  __dirname,
  '../node_modules/react-dom/umd/react-dom.production.min.js'
)
// const from3 = resolve(
//   __dirname,
//   '../node_modules/less/dist/less.min.js'
// )
const from4 = resolve(
  __dirname,
  '../node_modules/antd'
)
const from5 = resolve(
  __dirname,
  '../src/client/css/less-prod.less'
)
const from6 = resolve(
  __dirname,
  '../src/client/css/theme.less'
)
const to1 = resolve(
  __dirname,
  '../work/app/assets/images'
)
const to2 = resolve(
  __dirname,
  '../work/app/assets/icons'
)
const to3 = resolve(
  __dirname,
  '../work/app/assets/external'
)
const copy = new CopyWebpackPlugin({
  patterns: [{
    from,
    to: to1,
    force: true
  }, {
    from: from0,
    to: to2,
    force: true
  }, {
    from: from1,
    to: to3,
    force: true
  }, {
    from: from2,
    to: to3,
    force: true
  },
  // , {
  //   from: from3,
  //   to: to3,
  //   force: true
  // }
  {
    from: from5,
    to: to3,
    force: true
  }, {
    from: from6,
    to: to3,
    force: true
  }, {
    from: from4,
    to: to3,
    force: true,
    filter: (p) => p.endsWith('.less')
  }]
})
module.exports = copy
