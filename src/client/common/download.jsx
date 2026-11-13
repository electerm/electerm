/**
 * simulate download
 */
import { notification } from '../components/common/notification'
import ShowItem from '../components/common/show-item'
import { chooseSaveDirectory } from './choose-save-folder'
import { DownloadOutlined } from '@ant-design/icons'

const e = window.translate

/**
 * Save `text` to a file the user picks.
 *
 * @returns {Promise<boolean>} true when the file was written, false when the
 * user cancelled the picker or the write failed -- callers that hold a panel
 * open across the save (the bookmark export) need to tell those apart.
 */
export default async function download (filename, text) {
  // iOS WKWebView: sandbox targets are invisible to the Files app and
  // blob-anchor downloads are a no-op — save to Documents (visible in
  // Files) via the native bridge instead (see
  // web-components/native-file-save.js).
  if (window.et && window.et.isWebApp && window.et.saveTextNative) {
    try {
      await window.et.saveTextNative(filename, text)
      return true
    } catch (err) {
      console.log('native save failed, falling back to sandbox save:', err)
    }
  }
  const opts = window.et.isWebApp
    ? { filename, content: text }
    : undefined
  const savePath = await chooseSaveDirectory(opts)
  if (!savePath) {
    return false
  }
  const path = window.require('path')
  const filePath = path.join(savePath, filename)
  const r = await window.fs.writeFile(filePath, text).catch(window.store.onError)
  if (!r) {
    return false
  }
  notification.success({
    message: <DownloadOutlined />,
    description: (
      <>
        <ShowItem
          to={filePath}
        >
          {filePath}
        </ShowItem>
        <div className='mg1t'>
          {e('exportDataWarn')}
        </div>
      </>
    )
  })
  return true
}
