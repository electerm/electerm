/**
 * session tabs component
 * @param {array} props.tabs {id, title}
 */

import React from 'react'
import { shortcutExtend } from './shortcut-handler.js'
import { throttle } from 'lodash-es'

class ShortcutControl extends React.PureComponent {
  componentDidMount () {
    window.addEventListener('keydown', this.handleKeyboardEvent.bind(this))
    window.addEventListener('mousewheel', this.handleKeyboardEvent.bind(this))
  }

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

  splitShortcut = throttle((e) => {
    e.stopPropagation()
    const x = document.querySelector('.session-current .icon-split')
    x && x.click()
  }, 1000)

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
