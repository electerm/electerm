import BookmarkTransport from '../tree-list/bookmark-transport'
import download from '../../common/download'
import time from '../../common/time'
import copy from 'json-deep-copy'

export default class QmTransport extends BookmarkTransport {
  name = 'quickCommands'
  beforeUpload = async (file) => {
    const { store } = this.props
    const txt = await window.fs.readFile(file.path)
    try {
      const arr = JSON.parse(txt)
      const arrOld = copy(store[this.name])
      const bmTreeOld = arrOld.reduce((p, v) => {
        return {
          ...p,
          [v.id]: v
        }
      }, {})
      const add = []
      const dbAdd = []
      arr.forEach(bg => {
        if (!bmTreeOld[bg.id]) {
          arrOld.push(bg)
          add.push(bg)
          dbAdd.push({
            db: this.name,
            obj: bg
          })
        }
      })
      store.setState(
        this.name, arrOld
      )
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
    const arr = store[this.name]
    const txt = JSON.stringify(arr, null, 2)
    const stamp = time(undefined, 'YYYY-MM-DD-HH-mm-ss')
    download('electerm-' + this.name + '-' + stamp + '.json', txt)
  }
}
