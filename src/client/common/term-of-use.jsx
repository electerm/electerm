/**
 * Term of use confirmation gate for the AI config / data sync pages.
 *
 * Define `window.et.AITermOfUse` / `window.et.SyncTermOfUse` (injected the
 * same way as `defaultAIPreset` into the built index.html `_global` data)
 * to require users to confirm the term before entering those pages.
 * Confirmation is saved to localStorage, so it is only asked once.
 */

import Modal from '../components/common/modal'
import {
  aiTermOfUseConfirmedLsKey,
  syncTermOfUseConfirmedLsKey
} from './constants'
import * as ls from './safe-local-storage'

const e = window.translate

const termOfUseTypes = {
  ai: {
    etKey: 'AITermOfUse',
    lsKey: aiTermOfUseConfirmedLsKey
  },
  sync: {
    etKey: 'SyncTermOfUse',
    lsKey: syncTermOfUseConfirmedLsKey
  }
}

function isConfirmed (type) {
  return ls.getItem(termOfUseTypes[type].lsKey) === 'yes'
}

/**
 * Run `onConfirmed` after the term of use of `type` is confirmed.
 * When no term is defined, or it was confirmed before, `onConfirmed`
 * runs synchronously; otherwise a confirmation modal is shown and
 * `onConfirmed` only runs when the user confirms it.
 */
export function requireTermOfUse (type, onConfirmed) {
  const { etKey, lsKey } = termOfUseTypes[type]
  const content = window.et?.[etKey]
  const text = typeof content === 'string' ? content.trim() : ''
  if (!text || isConfirmed(type)) {
    return onConfirmed()
  }
  Modal.confirm({
    title: 'Terms of use',
    width: 600,
    maskClosable: false,
    content: (
      <div
        style={{
          maxHeight: '50vh',
          overflow: 'auto',
          whiteSpace: 'pre-wrap'
        }}
      >
        {text}
      </div>
    ),
    okText: e('haveRead'),
    cancelText: e('cancel'),
    onOk: () => {
      ls.setItem(lsKey, 'yes')
      onConfirmed()
    }
  })
}
