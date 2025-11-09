import BookmarkTransport from '../tree-list/bookmark-transport'
import download from '../../common/download'
import time from '../../common/time'
import { getFilePath } from '../../common/file-drop-utils'

export default class KeywordsTransport extends BookmarkTransport {
  name = 'keywords-highlight'
  beforeUpload = async (file) => {
    const { store } = this.props
    const filePath = getFilePath(file)
    const txt = await window.fs.readFile(filePath)
    try {
      store.setConfig({
        keywords: JSON.parse(txt)
      })
    } catch (e) {
      store.onError(e)
    }
    setTimeout(this.props.resetKeywordForm, 100)
    return false
  }

  renderEdit () {
    return null
  }

  handleDownload = () => {
    const { store } = this.props
    const arr = store.config.keywords || []
    const txt = JSON.stringify(arr, null, 2)
    const stamp = time(undefined, 'YYYY-MM-DD-HH-mm-ss')
    download('electerm-' + this.name + '-' + stamp + '.json', txt)
  }
}
