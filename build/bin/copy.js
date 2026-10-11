const { resolve } = require('path')
const { cp } = require('shelljs')
const from0 = resolve(
  __dirname,
  '../../node_modules/electerm-icons/icons'
)
const to2 = resolve(
  __dirname,
  '../../work/app/assets/icons'
)
const arr = [
  {
    from: from0,
    to: to2
  }
]

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
