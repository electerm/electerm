/**
 * Standalone Input/TextArea Context Menu Module
 * Automatically adds context menus to all input/textarea elements without code modification
 * Just import this module and render <InputContextMenu /> in your React app to activate
 */

import React, { useState, useEffect, useRef } from 'react'
import { Dropdown } from 'antd'
import iconsMap from '../sys-menu/icons-map.jsx'
import { copy, readClipboard, readClipboardAsync } from '../../common/clipboard.js'

const e = window.translate

/**
 * Check if element is input or textarea
 */
function isInputElement (element) {
  if (!element) return false
  const tagName = element.tagName.toLowerCase()
  return tagName === 'input' || tagName === 'textarea'
}

/**
 * Get input element state
 */
function getInputState (element) {
  if (!isInputElement(element)) return null

  const hasText = element.value && element.value.length > 0
  const hasSelection = element.selectionStart !== element.selectionEnd
  const isReadOnly = element.readOnly || element.disabled

  let hasClipboard = false
  try {
    const content = readClipboard()
    hasClipboard = content && content.length > 0
  } catch (error) {
    hasClipboard = false
  }

  return {
    hasText,
    hasSelection,
    hasClipboard,
    isReadOnly
  }
}

/**
 * Handle copy operation
 */
function handleCopy (element) {
  if (!isInputElement(element)) return

  const selectedText = element.value.substring(element.selectionStart, element.selectionEnd)
  if (selectedText) {
    copy(selectedText)
    console.log('Copied text:', selectedText.substring(0, 50))
  }
}

/**
 * Handle paste operation
 */
async function handlePaste (element) {
  if (!isInputElement(element) || element.readOnly || element.disabled) return

  element.focus()
  const clipboardText = await readClipboardAsync()

  if (clipboardText) {
    insertTextAtCursor(element, clipboardText)
  }
}

/**
 * Insert text at cursor position in input/textarea
 */
function insertTextAtCursor (element, text) {
  if (!isInputElement(element)) return

  element.focus()

  // Try modern approach first - using execCommand
  if (document.execCommand && document.queryCommandSupported('insertText')) {
    try {
      element.setSelectionRange(element.selectionStart, element.selectionEnd)
      const success = document.execCommand('insertText', false, text)
      if (success) {
        triggerInputEvents(element)
      }
    } catch (error) {
      console.log('execCommand insertText failed:', error)
    }
  }
}

/**
 * Trigger input events for React and other frameworks
 */
function triggerInputEvents (element) {
  const inputEvent = new Event('input', { bubbles: true, cancelable: true })
  element.dispatchEvent(inputEvent)

  const changeEvent = new Event('change', { bubbles: true, cancelable: true })
  element.dispatchEvent(changeEvent)

  // Handle React's internal event handlers
  const reactHandlers = Object.keys(element).find(key => key.startsWith('__reactProps') || key.startsWith('__reactEventHandlers'))
  if (reactHandlers) {
    const handler = element[reactHandlers]
    if (handler?.onChange) {
      handler.onChange({ target: element, currentTarget: element })
    }
  }
}

/**
 * Handle cut operation
 */
function handleCut (element) {
  if (!isInputElement(element) || element.readOnly || element.disabled) return

  const { selectionStart, selectionEnd } = element
  const selectedText = element.value.substring(selectionStart, selectionEnd)

  if (selectedText) {
    element.focus()
    element.setSelectionRange(selectionStart, selectionEnd)

    // Try using execCommand for cut
    if (document.execCommand && document.queryCommandSupported('cut')) {
      try {
        const success = document.execCommand('cut')
        if (success) {
          triggerInputEvents(element)
        }
      } catch (error) {
        console.log('execCommand cut failed:', error)
      }
    }
  }
}

/**
 * Handle select all operation
 */
function handleSelectAll (element) {
  if (!isInputElement(element)) return
  element.select()
  element.focus()
}

/**
 * Create context menu items based on input state
 */
function createContextMenuItems (element) {
  const state = getInputState(element)
  if (!state) return []

  const { hasText, hasSelection, hasClipboard, isReadOnly } = state

  return [
    {
      key: 'copy',
      icon: 'CopyOutlined',
      label: e('copy'),
      disabled: !hasSelection
    },
    {
      key: 'cut',
      icon: 'FileExcelOutlined',
      label: e('cut'),
      disabled: !hasSelection || isReadOnly
    },
    {
      key: 'paste',
      icon: 'SwitcherOutlined',
      label: e('paste'),
      disabled: !hasClipboard || isReadOnly
    },
    {
      key: 'selectAll',
      icon: 'CheckSquareOutlined',
      label: e('selectall'),
      disabled: !hasText
    }
  ]
}

/**
 * React Component for Input Context Menu
 * Mount this component in your app to enable context menus on all input/textarea elements
 */
const InputContextMenu = () => {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [targetElement, setTargetElement] = useState(null)
  const menuRef = useRef(null)

  const handleMenuClick = async ({ key }) => {
    // Keep reference to current element before closing menu
    const currentElement = targetElement
    // Close menu first
    setVisible(false)
    setTargetElement(null)
    // Execute action with preserved element reference
    if (currentElement) {
      setTimeout(async () => {
        try {
          switch (key) {
            case 'copy':
              handleCopy(currentElement)
              break
            case 'cut':
              handleCut(currentElement)
              break
            case 'paste':
              await handlePaste(currentElement)
              break
            case 'selectAll':
              handleSelectAll(currentElement)
              break
            default:
              console.warn('Unknown menu action:', key)
          }
        } catch (error) {
          console.error('Menu action failed:', error)
        }
      }, 10) // Small delay to ensure menu is closed
    }
  }

  useEffect(() => {
    const handleContextMenu = (event) => {
      const target = event.target
      if (isInputElement(target)) {
        event.preventDefault()
        event.stopPropagation()
        setPosition({ x: event.clientX, y: event.clientY })
        setTargetElement(target)
        setVisible(true)
      } else {
        setVisible(false)
        setTargetElement(null)
      }
    }

    const handleClick = (event) => {
      if (visible && menuRef.current && !menuRef.current.contains(event.target)) {
        setVisible(false)
        setTargetElement(null)
      }
    }

    document.addEventListener('contextmenu', handleContextMenu, true)
    document.addEventListener('click', handleClick, true)
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, true)
      document.removeEventListener('click', handleClick, true)
    }
  }, [visible])
  const items = createContextMenuItems(targetElement) || []
  const menuItems = items.map(item => {
    const IconComponent = item.icon && iconsMap[item.icon]
    return {
      ...item,
      icon: IconComponent ? <IconComponent /> : null
    }
  })
  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 9999
      }}
    >
      <Dropdown
        menu={{
          items: menuItems,
          onClick: handleMenuClick
        }}
        open={visible}
        placement='bottomLeft'
      >
        <div style={{ width: 1, height: 1 }} />
      </Dropdown>
    </div>
  )
}

export default InputContextMenu
