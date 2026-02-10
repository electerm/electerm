/**
 * simulate download
 */
import { notification } from '../components/common/notification'
import ShowItem from '../components/common/show-item'
import { chooseSaveDirectory } from './choose-save-folder'
import { DownloadOutlined } from '@ant-design/icons'

// function downloadForBrowser (filename, text) {
//   const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
//   const url = URL.createObjectURL(blob)
//   const a = document.createElement('a')
//   a.href = url
//   a.download = filename
//   document.body.appendChild(a)
//   a.click()
//   document.body.removeChild(a)
//   URL.revokeObjectURL(url)
// }

export default async function download (filename, text) {
  // if (window.et.isWebApp) {
  //   return downloadForBrowser(filename, text)
  // }
  const savePath = await chooseSaveDirectory()
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
