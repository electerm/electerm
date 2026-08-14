const { resolve } = require('path')
const { cp, mkdir } = require('shelljs')
const from = resolve(
  __dirname,
  '../../node_modules/@electerm/electerm-resource/tray-icons/*'
)
const from0 = resolve(
  __dirname,
  '../../node_modules/electerm-icons/icons'
)
const to1 = resolve(
  __dirname,
  '../../work/app/assets/images/'
)
const to2 = resolve(
  __dirname,
  '../../work/app/assets/icons'
)
const fromFonts = resolve(
  __dirname,
  '../../src/client/fonts/*'
)
const to3 = resolve(
  __dirname,
  '../../work/app/assets/fonts'
)
const arr = [
  {
    from,
    to: to1,
    file: true
  }, {
    from: from0,
    to: to2
  }, {
    from: fromFonts,
    to: to3,
    file: true
  }
]

mkdir('-p', to3)

for (const obj of arr) {
  const {
    file, from, to
  } = obj
  if (file) {
    cp(from, to)
  } else {
    cp('-r', from, to)
  }
}
