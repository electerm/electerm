/**
 * Trigger import/export, follows quick command transport.
 */
import BookmarkTransport from '../tree-list/bookmark-transport'
import download from '../../common/download'
import time from '../../common/time'
import { runImportTask } from '../../common/import-task'
import { normalizeTrigger } from '../../store/trigger'
import { validateTriggers } from '../terminal/automation/trigger-engine'

const e = window.translate

export default class TriggerTransport extends BookmarkTransport {
  name = 'triggers'

  beforeUpload = async (file) => {
    const { store } = this.props
    const txt = file.fileContent !== undefined
      ? file.fileContent
      : await window.fs.readFile(file.filePath)
    try {
      const arr = JSON.parse(txt).map(normalizeTrigger)
      const errors = validateTriggers(arr)
      if (errors.length) {
        throw new Error(errors[0])
      }
      const state = store[this.name]
      const existing = new Set(state.map(v => v.id))
      const fresh = arr.filter(t => !existing.has(t.id))
      if (!fresh.length) {
        return false
      }
      await runImportTask({
        title: e('import'),
        batch: 200,
        stopWatchers: [this.name],
        steps: [
          {
            label: e('trigger'),
            items: fresh,
            process: (chunk) => {
              state.push(...chunk)
            }
          }
        ]
      })
      store.refreshAllTriggers()
    } catch (err) {
      store.onError(err)
    }
    return false
  }

  handleDownload = () => {
    const { store } = this.props
    const txt = JSON.stringify(store[this.name] || [], null, 2)
    const stamp = time(undefined, 'YYYY-MM-DD-HH-mm-ss')
    download('electerm-' + this.name + '-' + stamp + '.json', txt)
  }
}
