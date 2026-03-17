import { useState, useCallback } from 'react'
import {
  Input,
  Tag
} from 'antd'

export default function Password ({ ref, onKeyDown, onKeyUp, onFocus, onBlur, prefix, ...props }) {
  const [isCapsLockOn, setIsCapsLockOn] = useState(false)

  const checkCapsLock = useCallback((event) => {
    if (event.getModifierState) {
      const capsLockState = event.getModifierState('CapsLock')
      setIsCapsLockOn(capsLockState)
    }
  }, [])

  const handleKeyEvent = useCallback((event) => {
    checkCapsLock(event)
    if (onKeyDown && event.type === 'keydown') {
      onKeyDown(event)
    }
    if (onKeyUp && event.type === 'keyup') {
      onKeyUp(event)
    }
  }, [onKeyDown, onKeyUp, checkCapsLock])

  const handleFocus = useCallback((event) => {
    checkCapsLock(event)
    if (onFocus) {
      onFocus(event)
    }
  }, [onFocus, checkCapsLock])

  const handleBlur = useCallback((event) => {
    setIsCapsLockOn(false)
    if (onBlur) {
      onBlur(event)
    }
  }, [onBlur])

  let capsPrefix = null
  if (isCapsLockOn) {
    capsPrefix = (
      <Tag color='orange' className='mg1r' variant='solid'>CAPS</Tag>
    )
  }

  let mergedPrefix = capsPrefix
  if (prefix) {
    mergedPrefix = (
      <>
        {capsPrefix}
        {prefix}
      </>
    )
  }

  return (
    <Input.Password
      {...props}
      ref={ref}
      prefix={mergedPrefix}
      onKeyDown={handleKeyEvent}
      onKeyUp={handleKeyEvent}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  )
}
