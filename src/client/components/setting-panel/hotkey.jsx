import React, { Component } from 'react'
import ShortcutEdit from '../shortcuts/shortcut-editor'
import { getKeysTakenData } from '../shortcuts/shortcut-utils'
import './setting.styl'

const e = window.translate

// Bidirectional maps for key conversions
const MODIFIER_MAP = {
  // Display format -> Electron format
  ctrl: 'CommandOrControl',
  meta: 'CommandOrControl',
  alt: 'Alt',
  shift: 'Shift',
  // Electron format -> Display format
  CommandOrControl: 'ctrl',
  Command: 'meta',
  Control: 'ctrl',
  Alt: 'alt',
  Shift: 'shift',
  Super: 'meta',
  Meta: 'meta'
}

const KEY_MAP = {
  // Display format -> Electron format
  '←': 'Left',
  '↑': 'Up',
  '→': 'Right',
  '↓': 'Down',
  '▲': 'mouseWheelUp',
  '▼': 'mouseWheelDown',
  enter: 'Return',
  // Electron format -> Display format
  Left: '←',
  Up: '↑',
  Right: '→',
  Down: '↓',
  Return: 'enter',
  Enter: 'enter',
  mouseWheelUp: '▲',
  mouseWheelDown: '▼'
}

export default class HotkeySetting extends Component {
  onChangeHotkey = (name, shortcut) => {
    // Convert shortcut from ShortcutEdit format to Electron accelerator format
    const electronShortcut = this.convertToElectronAccelerator(shortcut)
    return this.props.onSaveConfig({
      [name]: electronShortcut
    })
  }

  convertToElectronAccelerator = (shortcut) => {
    if (!shortcut) return shortcut

    // Split the shortcut into parts
    const parts = shortcut.split('+')
    const modifiers = []
    let key = ''

    // Process each part
    for (const part of parts) {
      const lowerPart = part.toLowerCase()
      if (MODIFIER_MAP[lowerPart]) {
        modifiers.push(MODIFIER_MAP[lowerPart])
      } else {
        // Handle special key mappings
        key = KEY_MAP[part] || part.toUpperCase()
      }
    }

    // Combine modifiers and key
    return [...modifiers, key].join('+')
  }

  convertFromElectronAccelerator = (electronShortcut) => {
    if (!electronShortcut) return electronShortcut

    // Split the shortcut into parts
    const parts = electronShortcut.split('+')
    const modifiers = []
    let key = ''

    // Process each part
    for (const part of parts) {
      if (MODIFIER_MAP[part]) {
        modifiers.push(MODIFIER_MAP[part])
      } else {
        // Handle special key mappings
        key = KEY_MAP[part] || part.toLowerCase()
      }
    }

    // Combine modifiers and key
    return [...modifiers, key].join('+')
  }

  getKeysTaken = (currentHotkey) => {
    const keysTaken = getKeysTakenData()

    // Convert current hotkey to display format for comparison
    const currentShortcutDisplay = this.convertFromElectronAccelerator(currentHotkey)

    // Remove current hotkey from taken keys (allow re-setting the same hotkey)
    delete keysTaken[currentShortcutDisplay]

    return keysTaken
  }

  render () {
    const { hotkey } = this.props
    const shortcutProps = {
      data: {
        name: 'hotkey',
        shortcut: this.convertFromElectronAccelerator(hotkey),
        index: 0
      },
      updateConfig: this.onChangeHotkey,
      keysTaken: this.getKeysTaken(hotkey)
    }

    return (
      <div className='pd2b'>
        <div className='pd1b'>{e('hotkeyDesc')}</div>
        <ShortcutEdit
          {...shortcutProps}
        />
      </div>
    )
  }
}
