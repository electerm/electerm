import { Modal } from 'antd'
import { createElement } from 'react'

const e = window.translate

function destinationName (type) {
  const names = {
    github: 'GitHub Gist',
    gitee: 'Gitee',
    cloud: 'Electerm Cloud',
    webdav: 'WebDAV',
    custom: 'API'
  }
  const name = names[type] || type
  const settings = window.store?.config?.syncSetting
  if (type === 'github' || type === 'gitee') {
    const id = settings?.[type + 'GistId']
    // A gist ID is a single alphanumeric identifier. Never display a URL,
    // authorization header or access token pasted into the wrong field.
    if (typeof id === 'string' && /^[a-z0-9]+$/i.test(id) && id !== settings[type + 'AccessToken']) {
      return `${name} (${id})`
    }
    return name
  }
  const url = settings?.[type === 'webdav' ? 'webdavServerUrl' : type + 'ApiUrl']
  if (url) {
    try {
      const { origin, pathname, protocol } = new URL(url)
      if (protocol === 'http:' || protocol === 'https:') {
        // Include the WebDAV folder or sync API path, excluding userinfo,
        // query parameters and the fragment, which may carry credentials.
        return `${name} (${origin}${pathname})`
      }
    } catch {}
  }
  return name
}

export function confirmUnencryptedTransfer ({ type, automatic = false, exporting = false }) {
  const title = exporting
    ? e('export')
    : automatic ? `${e('autoSync')} · ${e('upload')}` : e('uploadSettings')
  const content = exporting
    ? e('exportDataWarn')
    : [
        e('unencryptedSyncDetails'),
        createElement('div', { key: 'destination', className: 'mg1t' }, destinationName(type))
      ]
  return new Promise(resolve => {
    Modal.confirm({
      className: 'unencrypted-transfer-confirm',
      title,
      content,
      okText: e(exporting ? 'export' : automatic ? 'ok' : 'upload'),
      cancelText: e('cancel'),
      okButtonProps: { danger: true },
      focusable: { autoFocusButton: 'cancel' },
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
      afterClose: () => resolve(false)
    })
  })
}
