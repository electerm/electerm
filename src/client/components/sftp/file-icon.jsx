/**
 * file/folder icon by ext or name
 */

import { getIconForFile, getIconForFolder } from 'vscode-icons-js'
// import Icon from '@ant-design/icons'

export default function FileIcon ({ file, ...extra }) {
  const { extIconPath } = window.pre
  const name = file.isDirectory
    ? getIconForFolder(file.name)
    : getIconForFile(file.name)
  // const svg = <img src={iconPath + name} alt='' />
  return (
    <img
      src={extIconPath + name}
      height={12}
      alt=''
      {...extra}
    />
  )
}
