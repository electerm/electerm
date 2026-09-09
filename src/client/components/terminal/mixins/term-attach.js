import { debounce } from 'lodash-es'
import message from '../../common/message'
import { notification } from '../../common/notification'
import AttachAddon from '../attach-addon-custom.js'
import { createTriggerManager } from '../automation/index.js'
import { isWin } from '../../../common/constants.js'
import { isUnsafeFilename } from '../../../common/file-drop-utils.js'

/**
 * Everything that writes to the session: the socket attach addon, encoding,
 * quick commands / batch input, and the automation trigger manager that runs
 * on incoming data.
 */
export const attachMixin = {
  async initAttachAddon () {
    this.attachAddon = new AttachAddon(
      this.term,
      this.socket,
      isWin && !this.isRemote()
    )
    this.attachAddon.decoder = new TextDecoder(
      this.encode || this.props.tab.encode || 'utf-8'
    )
    await this.attachAddon.activate(this.term)
    if (this.osc52Addon) {
      this.osc52Addon.setSendData(this.attachAddon._sendData.bind(this.attachAddon))
    }
    this.initTriggerManager()
  },

  switchEncoding (encode) {
    this.encode = encode
    this.attachAddon.decoder = new TextDecoder(encode)
  },

  toggleKeepalive () {
    if (!this.attachAddon) {
      return false
    }
    this._keepaliveEnabled = !this._keepaliveEnabled
    this.attachAddon.setKeepalive(this._keepaliveEnabled)
    return this._keepaliveEnabled
  },

  batchInput (cmd) {
    this.attachAddon._sendData(cmd + '\r')
  },

  runQuickCommand (cmd, inputOnly = false) {
    if (this.term && this.attachAddon) {
      this.attachAddon._sendData(cmd + (inputOnly ? '' : '\r'))
      this.term.focus()
    }
  },

  cd (p) {
    if (isUnsafeFilename(p)) {
      return message.error('File name contains unsafe characters')
    }
    const isWinPath = /^[a-zA-Z]:\\/.test(p)
    this.runQuickCommand(isWinPath ? `cd /d "${p}"` : `cd "${p}"`)
  },

  initTriggerManager () {
    this.disposeTriggerManager()
    if (!this.attachAddon) {
      return
    }
    const attachAddon = this.attachAddon
    this.triggerManager = createTriggerManager({
      attachAddon,
      send: (payload) => {
        if (payload) {
          attachAddon._sendData(payload)
        }
      },
      getTriggers: () => {
        try {
          return window.store.getEffectiveTriggers(this.props.tab)
        } catch (e) {
          return []
        }
      },
      onFire: ({ rule, matched, kind }) => {
        if (kind === 'notify' && rule) {
          notification.warning({
            message: window.translate('triggers') + ': ' + (rule.name || rule.match?.value || ''),
            description: String(matched || '').slice(-240),
            duration: 6
          })
        }
      }
    })
  },

  refreshTriggers () {
    try {
      this.triggerManager?.refresh()
    } catch (e) {
      console.debug(e)
    }
  },

  disposeTriggerManager () {
    try {
      this.triggerManager?.dispose()
    } catch (e) {
      console.debug(e)
    }
    this.triggerManager = null
  },

  // Called by attach-addon-custom once per flushed write, so the tab badge
  // updates without one notification per network chunk.
  notifyOnData () {
    if (!this._notifyOnDataDebounced) {
      this._notifyOnDataDebounced = debounce(() => {
        window.store.notifyTabOnData(this.props.tab.id)
      }, 1000)
    }
    this._notifyOnDataDebounced()
  }
}
