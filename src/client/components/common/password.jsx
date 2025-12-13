import { useState, useCallback, forwardRef } from 'react'
import {
  Input,
  Tag
} from 'antd'

/**
 * Password component that extends Ant Design's Password component
 * with caps lock detection and visual indicator
 */
export default forwardRef(function Password (props, ref) {
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

  // Keep addonBefore as-is from props; must be null when caps lock is off
  const addonBefore = props.addonBefore ?? null

  // Show caps lock indicator inside prefix to avoid remounting the input wrapper
  let capsPrefix = null
  if (isCapsLockOn) {
    capsPrefix = (
      <Tag color='orange' className='mg1r' variant='solid'>CAPS</Tag>
    )
  }

  // Merge any existing prefix from props with our caps indicator
  let prefix = capsPrefix
  if (props.prefix) {
    prefix = (
      <>
        {capsPrefix}
        {props.prefix}
      </>
    )
  }

  return (
    <Input.Password
      {...props}
      ref={ref}
      addonBefore={addonBefore}
      prefix={prefix}
      onKeyDown={handleKeyEvent}
      onKeyUp={handleKeyEvent}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  )
})
