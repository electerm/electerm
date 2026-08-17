import BookmarkTransport from '../tree-list/bookmark-transport'
import download from '../../common/download'
import time from '../../common/time'
import { runImportTask } from '../../common/import-task'

const e = window.translate

export default class QmTransport extends BookmarkTransport {
  name = 'quickCommands'

  beforeUpload = async (file) => {
    const { store } = this.props
    const txt = file.fileContent !== undefined
      ? file.fileContent
      : await window.fs.readFile(file.filePath)
    try {
      const arr = JSON.parse(txt)
      const state = store[this.name]
      const existing = new Set(state.map(v => v.id))
      const fresh = arr.filter(bg => !existing.has(bg.id))
      if (!fresh.length) {
        return false
      }
      await runImportTask({
        title: e('import'),
        batch: 200,
        stopWatchers: [this.name],
        steps: [
          {
            label: e('quickCommands'),
            items: fresh,
            process: (chunk) => {
              state.push(...chunk)
            }
          }
        ]
      })
    } catch (err) {
      store.onError(err)
    }
    return false
  }

  handleDownload = () => {
    const { store } = this.props
    const arr = store[this.name]
    const txt = JSON.stringify(arr, null, 2)
    const stamp = time(undefined, 'YYYY-MM-DD-HH-mm-ss')
    download('electerm-' + this.name + '-' + stamp + '.json', txt)
  }
}
