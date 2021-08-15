import BookmarkTransport from '../setting-panel/bookmark-transport'
import download from '../../common/download'
import time from '../../../app/common/time'
import copy from 'json-deep-copy'

export default class QmTransport extends BookmarkTransport {
  beforeUpload = (file) => {
    const { store } = this.props
    const txt = window.pre
      .readFileSync(file.path).toString()
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

  down = () => {
    const { store } = this.props
    const {
      quickCommands
    } = store
    const txt = JSON.stringify(quickCommands, null, 2)
    const stamp = time(undefined, 'YYYY-MM-DD-HH-mm-ss')
    download('quickCommands-' + stamp + '.json', txt)
  }
}
