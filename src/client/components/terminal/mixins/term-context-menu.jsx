import Modal from '../../common/modal'
import { readClipboardAsync, readClipboard, copy } from '../../../common/clipboard.js'
import { isWin, isMac, isMacJs, connectionMap } from '../../../common/constants.js'
import iconsMap from '../../sys-menu/icons-map.jsx'
import { refsStatic } from '../../common/ref.js'
import AIIcon from '../../icons/ai-icon.jsx'
import { isAIDisabled } from '../../../common/ai-feature.js'

const e = window.translate

/**
 * The right-click (and long-press) menu plus the clipboard actions behind it.
 * Menu item `key`s are method names, so `onContextMenu` just dispatches.
 */
export const contextMenuMixin = {
  renderContextMenu () {
    const { hasSelection, recording } = this.state
    const copyed = true
    const copyShortcut = this.getShortcut('terminal_copy')
    const pasteShortcut = this.getShortcut('terminal_paste')
    const clearShortcut = this.getShortcut('terminal_clear')
    const searchShortcut = this.getShortcut('terminal_search')
    const selectAllShortcut = isMacJs ? 'meta+a' : 'ctrl+shift+a'
    const isSerial = this.props.tab?.type === connectionMap.serial
    const items = [
      {
        key: 'onCopy',
        icon: <iconsMap.CopyOutlined />,
        label: e('copy'),
        disabled: !hasSelection,
        extra: copyShortcut
      },
      {
        key: 'onPaste',
        icon: <iconsMap.SwitcherOutlined />,
        label: e('paste'),
        disabled: !copyed,
        extra: pasteShortcut
      },
      {
        key: 'onPasteSelected',
        icon: <iconsMap.SwitcherOutlined />,
        label: e('pasteSelected'),
        disabled: !hasSelection
      },
      {

        key: 'onSelectAll',
        icon: <iconsMap.CheckSquareOutlined />,
        label: e('selectall'),
        extra: selectAllShortcut
      },
      ...(
        isAIDisabled()
          ? []
          : [{
              key: 'explainWithAi',
              icon: <AIIcon />,
              label: e('explainWithAi'),
              disabled: !hasSelection
            }]
      ),
      {
        key: 'onClear',
        icon: <iconsMap.ReloadOutlined />,
        label: e('clear'),
        extra: clearShortcut
      },
      {
        key: 'toggleSearch',
        icon: <iconsMap.SearchOutlined />,
        label: e('search'),
        extra: searchShortcut
      },
      {
        key: 'onSaveTerminalLog',
        icon: <iconsMap.SaveOutlined />,
        label: e('saveTerminalLogToFile')
      },
      {
        key: recording ? 'onStopRecord' : 'onRecord',
        icon: recording ? <iconsMap.StopOutlined /> : <iconsMap.PlayCircleFilled />,
        label: e(recording ? 'stopRecord' : 'record')
      }
    ]
    if (isSerial) {
      items.push(
        {
          type: 'divider'
        },
        {
          key: 'onXmodemSend',
          icon: <iconsMap.CloudUploadOutlined />,
          label: 'XMODEM Send'
        },
        {
          key: 'onXmodemReceive',
          icon: <iconsMap.CloudDownloadOutlined />,
          label: 'XMODEM Receive'
        }
      )
    }
    return items
  },

  onContextMenu ({ key }) {
    this[key]()
  },

  onContextMenuInner (e) {
    e.preventDefault()
    if (this.state.loading) {
      return
    }
    if (this.props.config.pasteWhenContextMenu) {
      return this.onPaste()
    }
  },

  onSelection () {
    if (
      !this.props.config.copyWhenSelect ||
      window.store.onOperation
    ) {
      return false
    }
    this.copySelectionToClipboard()
  },

  copySelectionToClipboard () {
    const txt = this.term.getSelection()
    if (txt) {
      copy(txt)
    }
  },

  tryInsertSelected () {
    const txt = this.term.getSelection()
    if (txt) {
      this.attachAddon._sendData(txt)
    }
  },

  onCopy () {
    const selected = this.term.getSelection()
    copy(selected)
    this.term.focus()
  },

  onSelectAll () {
    this.term.selectAll()
  },

  pasteTextTooLong () {
    if (this.props.config.disableConfirmForLargeClipboardContent) {
      return false
    }
    if (window.et.isWebApp) {
      return false
    }
    const text = readClipboard()
    return text.length > 500
  },

  askUserConfirm () {
    Modal.confirm({
      title: e('paste'),
      content: (
        <div>
          <p>{e('paste')}:</p>
          <div className='paste-text'>
            <pre>
              <code>{readClipboard()}</code>
            </pre>
          </div>
        </div>
      ),
      okText: e('ok'),
      cancelText: e('cancel'),
      onOk: () => this.onPaste(true)
    })
  },

  async onPaste (skipTextLengthCheck) {
    let selected = await readClipboardAsync()
    if (
      !skipTextLengthCheck &&
      !this.props.config.disableConfirmForLargeClipboardContent &&
      selected.length > 500
    ) {
      return this.askUserConfirm()
    }
    if (isWin && this.isRemote()) {
      selected = selected.replace(/\r\n/g, '\n')
    }
    this.term.paste(selected || '')
    this.term.focus()
  },

  onPasteSelected () {
    const selected = this.term.getSelection()
    this.term.paste(selected || '')
    this.term.focus()
  },

  onClear () {
    const shouldClear = this.searchAddon &&
      window.store.termSearchOpen &&
      window.store.termSearch
    if (
      shouldClear
    ) {
      this.searchAddon.clearDecorations()
    }
    this.term.clear()
    this.term.focus()
    if (shouldClear) {
      this.searchAddon._lineCache.clear()
      this.timers.clearSearchTimer = setTimeout(() => {
        refsStatic.get('term-search')?.next()
      }, 100)
    }
  },

  onXmodemSend () {
    if (this.xmodemClient) {
      this.xmodemClient.initiateSend()
    }
    this.term.focus()
  },

  onXmodemReceive () {
    if (this.xmodemClient) {
      this.xmodemClient.initiateReceive()
    }
    this.term.focus()
  },

  explainWithAi () {
    window.store.explainWithAi(
      this.term.getSelection()
    )
  },

  // ---- shortcut handlers, wired up by shortcutExtend ----
  clearShortcut (e) {
    e.stopPropagation()
    this.onClear()
  },

  // selectAllShortcut = (e) => {
  //   e.stopPropagation()
  //   this.term.selectAll()
  // }

  copyShortcut (e) {
    const sel = this.term.getSelection()
    if (sel) {
      e.stopPropagation()
      this.copySelectionToClipboard()
      return false
    }
  },

  pasteSelectedShortcut (e) {
    e.stopPropagation()
    this.tryInsertSelected()
  },

  searchShortcut (e) {
    e.stopPropagation()
    this.toggleSearch()
  },

  pasteShortcut (e) {
    if (this.pasteTextTooLong()) {
      this.askUserConfirm()
      e.preventDefault()
      e.stopPropagation()
      return false
    }
    if (isMac) {
      return true
    }
    if (!this.isRemote()) {
      return true
    }
    if (this.term.buffer.active.type !== 'alternate') {
      return false
    }
    return true
  },

  showNormalBufferShortcut (e) {
    e.stopPropagation()
    this.openNormalBuffer()
  }
}
