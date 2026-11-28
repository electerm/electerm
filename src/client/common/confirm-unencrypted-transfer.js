import { Modal } from 'antd'

// Locale dictionaries ship separately. Keep the warning readable when the
// installed dictionary does not yet contain these messages.
function t (key, fallback) {
  return window.getLang?.()?.[key] || fallback
}

function destinationName (type) {
  const names = {
    github: 'GitHub Gist',
    gitee: 'Gitee',
    cloud: 'Electerm Cloud',
    webdav: 'WebDAV',
    custom: t('customSyncServer', 'your custom sync server')
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
  let title, action, details
  if (exporting) {
    title = t('unencryptedBackupTitle', 'Export an unencrypted backup?')
    action = t('exportBackup', 'Export backup')
    details = t('unencryptedBackupDetails', 'The JSON backup file will store your data in plaintext.')
  } else {
    title = automatic
      ? t('unencryptedAutoSyncTitle', 'Allow unencrypted automatic uploads?')
      : t('unencryptedSyncTitle', 'Upload without encryption?')
    action = automatic
      ? t('allowAutomaticUploads', 'Allow automatic uploads')
      : t('uploadOnce', 'Upload once')
    details = automatic
      ? t('unencryptedAutoSyncDetails', 'Allow Electerm to upload your selected data to {destination} automatically throughout this app session. The destination will store it in plaintext.')
      : t('unencryptedSyncDetails', 'Your selected data will be stored in plaintext at {destination}.')
    details = details.replace('{destination}', () => destinationName(type))
  }
  const risk = t('unencryptedTransferRisk', 'Anyone with access to that copy can read any secrets it contains, including bookmark passwords, SSH private keys, and AI API keys.')
  return new Promise(resolve => {
    Modal.confirm({
      className: 'unencrypted-transfer-confirm',
      title,
      content: `${details} ${risk}`,
      okText: action,
      cancelText: window.translate('cancel'),
      okButtonProps: { danger: true },
      focusable: { autoFocusButton: 'cancel' },
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
      afterClose: () => resolve(false)
    })
  })
}
