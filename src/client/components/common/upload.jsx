/**
 * Custom Upload component that uses Electron's native file dialog
 * This replaces antd Upload to get absolute file paths instead of browser-based file selection
 */

import { PureComponent } from 'react'
import { getLocalFileInfo } from '../sftp/file-read'

/**
 * Open a single file select dialog
 * @returns {Promise<Object|null>} - File object with path info or null if cancelled
 */
const openFileSelect = async () => {
  const properties = [
    'openFile',
    'showHiddenFiles',
    'noResolveAliases',
    'treatPackageAsDirectory',
    'dontAddToRecent'
  ]
  const files = await window.api.openDialog({
    title: 'Choose a file',
    message: 'Choose a file',
    properties
  }).catch(() => false)
  if (!files || !files.length) {
    return null
  }
  const filePath = files[0]
  const stat = await getLocalFileInfo(filePath)
  return { ...stat, filePath, path: filePath }
}

/**
 * Custom Upload component
 * Uses Electron's native file dialog for file selection
 * API compatible with antd Upload for the use cases in this project
 */
export default class Upload extends PureComponent {
  handleClick = async () => {
    const { beforeUpload, disabled } = this.props
    if (disabled) {
      return
    }
    const file = await openFileSelect()
    if (!file) {
      return
    }
    if (beforeUpload) {
      beforeUpload(file)
    }
  }

  render () {
    const {
      children,
      className,
      style,
      disabled
    } = this.props

    return (
      <div
        className={className}
        style={style}
        onClick={this.handleClick}
        role='button'
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
      >
        {children}
      </div>
    )
  }
}
