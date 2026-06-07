/**
 * simulate download
 */
import { notification } from '../components/common/notification'
import ShowItem from '../components/common/show-item'
import { chooseSaveDirectory } from './choose-save-folder'
import { DownloadOutlined } from '@ant-design/icons'

export default async function download (filename, text) {
  const opts = window.et.isWebApp
    ? { filename, content: text }
    : undefined
  const savePath = await chooseSaveDirectory(opts)
  if (!savePath) {
    return
  }
  const path = window.require('path')
  const filePath = path.join(savePath, filename)
  const r = await window.fs.writeFile(filePath, text).catch(window.store.onError)
  if (!r) {
    return
  }
  notification.success({
    message: <DownloadOutlined />,
    description: (
      <ShowItem
        to={filePath}
      >
        {filePath}
      </ShowItem>
    )
  })
}
