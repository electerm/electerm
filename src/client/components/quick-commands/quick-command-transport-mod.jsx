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
      const state = store[this.name]
      const arrOld = copy(state)
      const bmTreeOld = arrOld.reduce((p, v) => {
        return {
          ...p,
          [v.id]: v
        }
      }, {})
      arr.forEach(bg => {
        if (!bmTreeOld[bg.id]) {
          state.push(bg)
        }
      })
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
