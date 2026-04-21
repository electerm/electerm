const { echo, rm } = require('shelljs')
const {
  run,
  writeSrc,
  uploadToR2,
  builder: pb,
  reBuild,
  replaceJSON
} = require('./build-common')

async function main () {
  echo('running build for Windows ARM64')

  echo('build tar.gz for Windows ARM64')
  const src = 'win-arm64.tar.gz'
  rm('-rf', 'dist')
  writeSrc(src)
  replaceJSON(
    (data) => {
      data.win.target = ['tar.gz']
    }
  )
  await run(`${reBuild} --arch arm64 -f work/app`)
  await run(`${pb} --win --arm64`)
  await uploadToR2(src)
}

main()
