const { echo, rm } = require('shelljs')
const {
  run,
  writeSrc,
  uploadToR2,
  builder: pb
} = require('./build-common')

async function main () {
  echo('running build for linux part 2')

  echo('build rpm')
  rm('-rf', 'dist')
  let src = 'linux-x86_64.rpm'
  writeSrc(src)
  await run(`${pb} --linux rpm`)
  await uploadToR2(src)

  echo('build snap')
  rm('-rf', 'dist')
  src = 'linux-amd64.snap'
  writeSrc(src)
  await run(`${pb} --linux snap -p always`)
  await uploadToR2(src)
}

main()
