import { useState, useCallback } from 'react'
import {
  Input,
  Tag
} from 'antd'

/**
 * Password component that extends Ant Design's Password component
 * with caps lock detection and visual indicator
 */
export default function Password (props) {
  const [isCapsLockOn, setIsCapsLockOn] = useState(false)

  // Check caps lock state from keyboard event
  const checkCapsLock = useCallback((event) => {
    if (event.getModifierState) {
      const capsLockState = event.getModifierState('CapsLock')
      setIsCapsLockOn(capsLockState)
    }
  }, [])

  // Handle key events to detect caps lock changes
  const handleKeyEvent = useCallback((event) => {
    checkCapsLock(event)
    // Call original onKeyDown/onKeyUp if provided
    if (props.onKeyDown && event.type === 'keydown') {
      props.onKeyDown(event)
    }
    if (props.onKeyUp && event.type === 'keyup') {
      props.onKeyUp(event)
    }
  }, [props.onKeyDown, props.onKeyUp, checkCapsLock])

  // Handle focus event to check initial caps lock state
  const handleFocus = useCallback((event) => {
    checkCapsLock(event)
    // Call original onFocus if provided
    if (props.onFocus) {
      props.onFocus(event)
    }
  }, [props.onFocus, checkCapsLock])

  // Handle blur event to reset caps lock state
  const handleBlur = useCallback((event) => {
    setIsCapsLockOn(false)
    // Call original onBlur if provided
    if (props.onBlur) {
      props.onBlur(event)
    }
  }, [props.onBlur])

  // Caps lock indicator icon
  const capsLockIcon = isCapsLockOn
    ? (
      <Tag
        color='red'
      >
        A
      </Tag>
      )
    : null

  // Merge addonBefore with caps lock indicator
  const addonBefore = capsLockIcon || props.addonBefore || null

  return (
    <Input.Password
      {...props}
      addonBefore={addonBefore}
      onKeyDown={handleKeyEvent}
      onKeyUp={handleKeyEvent}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  )
}
