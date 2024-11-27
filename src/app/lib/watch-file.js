const fs = require('original-fs')
const globalState = require('./glob-state')
function onWatch (curr, prev) {
  try {
    const text = fs.readFileSync(globalState.get('watchFilePath')).toString()
    globalState.get('win').webContents.send('file-change', text)
  } catch (e) {
    console.log('send file change fail', e)
  }
}

exports.watchFile = (path) => {
  globalState.set('watchFilePath', path)
  fs.watchFile(path, onWatch)
}

exports.unwatchFile = (path) => {
  globalState.set('watchFilePath', '')
  fs.unwatchFile(path, onWatch)
}
