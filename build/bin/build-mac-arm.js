const { echo, rm } = require('shelljs')
const {
  run,
  writeSrc,
  uploadToR2,
  builder: pb,
  reBuild
} = require('./build-common')

async function main () {
  echo('running build for mac arm')

  echo('build dmg')
  const src = 'mac-arm64.dmg'
  rm('-rf', 'dist')
  writeSrc(src)
  await run(`${reBuild} --arch arm64 -f work/app`)
  await run(`${pb} --mac --arm64`)
  await uploadToR2(src)
}

main()
