const { echo, rm } = require('shelljs')
const {
  run,
  writeSrc,
  uploadToR2,
  builder: pb,
  replaceJSON,
  renameDist
} = require('./build-common')

// Function to add "-legacy" suffix to artifact names in electron-builder.json
function addLegacySuffix () {
  echo('============')
  echo('Updating electron-builder.json to add -legacy suffix')
  replaceJSON((data) => {
    // Update main artifactName
    if (data.artifactName) {
      data.artifactName = data.artifactName.replace('${productName}-${version}-${os}-${arch}.${ext}', '${productName}-${version}-${os}-${arch}-legacy.${ext}') // eslint-disable-line
    }
  })
  echo('Updated artifact names with -legacy suffix')
}

async function main () {
  echo('============')
  echo('Starting legacy Linux build process')
  echo('============')

  // Add legacy suffix to names
  addLegacySuffix()

  echo('============')
  echo('Building tar.gz package')
  echo('============')
  rm('-rf', 'dist')
  let src = 'linux-x64-legacy.tar.gz'
  writeSrc(src)
  await run(`${pb} --linux tar.gz`)
  await uploadToR2(src)
  renameDist()

  echo('============')
  echo('Building deb package')
  echo('============')
  rm('-rf', 'dist')
  src = 'linux-amd64-legacy.deb'
  writeSrc(src)
  await run(`${pb} --linux deb`)
  await uploadToR2(src)
  renameDist()

  echo('============')
  echo('Building rpm package')
  echo('============')
  rm('-rf', 'dist')
  src = 'linux-x86_64-legacy.rpm'
  writeSrc(src)
  replaceJSON((data) => {
    data.linux.target = ['rpm']
  })
  await run(`${pb} --linux rpm`)
  await uploadToR2(src)
  renameDist()

  echo('============')
  echo('Building AppImage package')
  echo('============')
  rm('-rf', 'dist')
  src = 'linux-x86_64-legacy.AppImage'
  writeSrc(src)
  replaceJSON((data) => {
    data.linux.target = ['AppImage']
  })
  await run(`${pb} --linux`)
  await uploadToR2(src)
  renameDist()

  echo('============')
  echo('Legacy Linux build process completed')
  echo('============')
}

main()
