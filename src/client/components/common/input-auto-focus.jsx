import { useEffect, useRef } from 'react'
import {
  Input
} from 'antd'
import Password from './password'

export default function InputAutoFocus (props) {
  const { type, selectall = false, ref, ...rest } = props
  const inputRef = useRef(null)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (inputRef.current) {
      const { value } = props
      if (value && selectall && isFirstRender.current) {
        inputRef.current.focus()
        if (inputRef.current.setSelectionRange) {
          inputRef.current.setSelectionRange(0, value.length)
        } else if (inputRef.current.select) {
          inputRef.current.select()
        }
        isFirstRender.current = false
      } else {
        inputRef.current.focus()
      }
    }
  }, [props.selectall])

  let InputComponent
  switch (type) {
    case 'password':
      InputComponent = Password
      break
    default:
      InputComponent = Input
  }

  const handleRef = (node) => {
    inputRef.current = node
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref) {
      ref.current = node
    }
  }

  return (
    <InputComponent
      ref={handleRef}
      {...rest}
    />
  )
}
