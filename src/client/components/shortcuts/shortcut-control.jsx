/**
 * session tabs component
 * @param {array} props.tabs {id, title}
 */

import React from 'react'
import { shortcutExtend } from './shortcut-handler.js'
import { throttle } from 'lodash-es'
import {
  typeMap
} from '../../common/constants'
import { refs, refsStatic } from '../common/ref'
import keyControlPressed from '../../common/key-control-pressed'
import keyPressed from '../../common/key-pressed'

function isInputActive () {
  const activeElement = document.activeElement
  return activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.isContentEditable
  )
}

class ShortcutControl extends React.PureComponent {
  componentDidMount () {
    const onEvent = this.handleKeyboardEvent.bind(this)
    document.addEventListener('keydown', this.onEvent, true)
    document.addEventListener('mousedown', onEvent)
    document.addEventListener('mousewheel', onEvent)
  }

  onEvent = (e) => {
    // First check SFTP shortcuts
    this.handleSftpKeyboardEvent(e)
    // Then handle extended shortcuts
    this.handleKeyboardEvent(e)
  }

  getActiveSftp = () => {
    const { activeTabId } = window.store
    if (!activeTabId) return null
    const ref = refs.get('sftp-' + activeTabId)
    if (!ref || !ref.isActive()) return null
    return ref
  }

  // SFTP shortcuts handler
  handleSftpKeyboardEvent = (e) => {
    const activeSftp = this.getActiveSftp()
    if (!activeSftp || activeSftp.state.onDelete || isInputActive()) {
      return
    }

    const lastClickedFile = activeSftp.state.lastClickedFile || {
      type: typeMap.local
    }
    const { type } = lastClickedFile
    const { inputFocus } = activeSftp

    if (keyControlPressed(e) && keyPressed(e, 'keyA') && !inputFocus) {
      e.stopPropagation()
      activeSftp.selectAll(type, e)
    } else if (keyPressed(e, 'arrowdown') && !inputFocus) {
      e.stopPropagation()
      activeSftp.selectNext(type)
    } else if (keyPressed(e, 'arrowup') && !inputFocus) {
      e.stopPropagation()
      activeSftp.selectPrev(type)
    } else if (keyPressed(e, 'delete') && !inputFocus && !activeSftp.state.onEditFile) {
      e.stopPropagation()
      activeSftp.delFiles(type)
    } else if (keyPressed(e, 'enter') && !inputFocus && !activeSftp.onDelete) {
      e.stopPropagation()
      activeSftp.enter(type, e)
    } else if (keyControlPressed(e) && keyPressed(e, 'keyC') && !inputFocus) {
      e.stopPropagation()
      activeSftp.doCopy(type, e)
    } else if (keyControlPressed(e) && keyPressed(e, 'keyX') && !inputFocus) {
      e.stopPropagation()
      activeSftp.doCut(type, e)
    } else if (keyControlPressed(e) && keyPressed(e, 'keyV') && !inputFocus) {
      e.stopPropagation()
      activeSftp.doPaste(type, e)
    } else if (keyPressed(e, 'f5')) {
      e.stopPropagation()
      activeSftp.onGoto(type)
    }
  }

  searchShortcut = throttle((e) => {
    e.stopPropagation()
    refsStatic.get('term-search')?.toggleSearch()
  }, 500)

  closeCurrentTabShortcut = throttle((e) => {
    e.stopPropagation()
    const { activeTabId } = window.store
    if (activeTabId) {
      window.store.delTab(activeTabId)
    }
  }, 500)

  mouseWheelDownCloseTabShortcut = throttle((e) => {
    e.stopPropagation()

    // Check if the event target is within a .tab element
    const tabElement = e.target.closest('.tab')
    if (tabElement) {
      const tabId = tabElement.getAttribute('data-id')
      if (tabId) {
        window.store.delTab(tabId)
      }
    }
  }, 500)

  reloadCurrentTabShortcut = throttle((e) => {
    e.stopPropagation()
    window.store.reloadTab()
  }, 500)

  cloneToNextLayoutShortcut = throttle((e) => {
    e.stopPropagation()
    window.store.cloneToNextLayout()
  }, 500)

  prevTabShortcut = throttle((e) => {
    e.stopPropagation()
    window.store.clickPrevTab()
  }, 500)

  nextTabShortcut = throttle((e) => {
    e.stopPropagation()
    window.store.clickNextTab()
  }, 500)

  newBookmarkShortcut = throttle((e) => {
    e.stopPropagation()
    window.store.onNewSsh()
  }, 500)

  togglefullscreenShortcut = throttle((e) => {
    e.stopPropagation()
    const x = document.querySelector('.term-fullscreen-control') ||
    document.querySelector('.session-current .term-fullscreen-control1')
    x && x.click()
  }, 500)

  zoominShortcut = throttle((e) => {
    e.stopPropagation()
    window.store.zoom(0.25, true)
  }, 1000)

  zoomoutShortcut = throttle((e) => {
    e.stopPropagation()
    window.store.zoom(-0.25, true)
  }, 1000)

  zoominTerminalShortcut = throttle((event) => {
    if (window.store.inActiveTerminal) {
      window.store.zoomTerminal(event.wheelDeltaY || 120)
    } else {
      const plus = 0.2
      window.store.zoom(plus, true)
    }
  }, 1000)

  zoomoutTerminalShortcut = throttle((event) => {
    if (window.store.inActiveTerminal) {
      window.store.zoomTerminal(event.wheelDeltaY || -120)
    } else {
      const plus = -0.2
      window.store.zoom(plus, true)
    }
  }, 1000)

  render () {
    return null
  }
}

export default shortcutExtend(ShortcutControl)
