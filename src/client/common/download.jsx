/**
 * simulate download
 */
import { notification } from 'antd'
import ShowItem from '../components/common/show-item'
import { chooseSaveDirectory } from './choose-save-folder'

export default async function download (filename, text) {
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
    message: '',
    description: (
      <div>
        <ShowItem
          to={filePath}
        >
          {filePath}
        </ShowItem>
      </div>
    )
  })
}
