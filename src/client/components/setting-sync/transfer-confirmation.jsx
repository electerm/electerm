import { Modal } from 'antd'
import { useLayoutEffect } from 'react'
import { refsStatic } from '../common/ref'

const e = window.translate
const refKey = 'unencryptedTransferConfirmation'

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

export function confirmUnencryptedTransfer ({ type, enableAutoSync = false, exporting = false }) {
  const title = e(exporting ? 'export' : enableAutoSync ? 'autoSync' : 'uploadSettings')
  const content = exporting
    ? e('exportDataWarn')
    : (
      <>
        {e('unencryptedSyncDetails')}
        {type && <div className='mg1t'>{destinationName(type)}</div>}
      </>
      )
  const confirm = refsStatic.get(refKey)
  return confirm?.({
    className: 'unencrypted-transfer-confirm',
    title,
    content,
    okText: e(exporting ? 'export' : enableAutoSync ? 'ok' : 'upload'),
    cancelText: e('cancel'),
    okButtonProps: { danger: true },
    focusable: { autoFocusButton: 'cancel' }
  })
}

export function TransferConfirmation () {
  const [modal, contextHolder] = Modal.useModal()
  useLayoutEffect(() => {
    const pending = new Set()
    refsStatic.add(refKey, options => new Promise(resolve => {
      function finish (answer) {
        pending.delete(finish)
        resolve(answer)
      }
      pending.add(finish)
      modal.confirm({
        ...options,
        onOk: () => finish(true),
        onCancel: () => finish(false),
        afterClose: () => finish()
      })
    }))
    return () => {
      refsStatic.remove(refKey)
      for (const finish of pending) finish()
    }
  }, [modal])
  return contextHolder
}
