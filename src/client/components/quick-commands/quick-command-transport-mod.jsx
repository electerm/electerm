import BookmarkTransport from '../setting-panel/bookmark-transport'
import download from '../../common/download'
import time from '../../common/time'
import copy from 'json-deep-copy'

export default class QmTransport extends BookmarkTransport {
  beforeUpload = async (file) => {
    const { store } = this.props
    const txt = await window.fs.readFile(file.path)
    try {
      const quickCommands = JSON.parse(txt)
      const quickCommandsOld = copy(store.quickCommands)
      const bmTreeOld = quickCommandsOld.reduce((p, v) => {
        return {
          ...p,
          [v.id]: v
        }
      }, {})
      const add = []
      const dbAdd = []
      quickCommands.forEach(bg => {
        if (!bmTreeOld[bg.id]) {
          quickCommandsOld.push(bg)
          add.push(bg)
          dbAdd.push({
            db: 'quickCommands',
            obj: bg
          })
        }
      })
      store.storeAssign({
        quickCommands: quickCommandsOld
      })
      store.batchDbAdd(dbAdd)
    } catch (e) {
      store.onError(e)
    }
    return false
  }

  renderEdit () {
    return null
  }

  handleDownload = () => {
    const { store } = this.props
    const {
      quickCommands
    } = store
    const txt = JSON.stringify(quickCommands, null, 2)
    const stamp = time(undefined, 'YYYY-MM-DD-HH-mm-ss')
    download('quickCommands-' + stamp + '.json', txt)
  }
}
