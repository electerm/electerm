// delete-yml.js
const fs = require('fs')
const path = require('path')

exports.default = async function (context) {
  // context.outDir is the path to the build output directory
  const ymlFiles = fs.readdirSync(context.outDir).filter(file => {
    return path.extname(file) === '.yml'
  })

  ymlFiles.forEach(file => {
    const filePath = path.join(context.outDir, file)
    console.log(`Deleting auto-update file: ${filePath}`)
    fs.unlinkSync(filePath)
  })
}
