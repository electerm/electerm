import { useEffect, useRef } from 'react'
import {
  Input
} from 'antd'

export default function InputAutoFocus (props) {
  const { type, ...rest } = props
  const inputRef = useRef(null)

  useEffect(() => {
    if (inputRef.current) {
      const { value, selectall = false } = props
      const index = value?.lastIndexOf('.')
      const hasExt = index > 0

      if (value && !selectall && hasExt) {
        inputRef.current.focus()
        inputRef.current.setSelectionRange(0, index)
      } else {
        inputRef.current.select()
      }
    }
  }, [props.value, props.selectall]) // Focus when these props change
  let InputComponent
  switch (type) {
    case 'password':
      InputComponent = Input.Password
      break
    default:
      InputComponent = Input
  }
  return (
    <InputComponent
      ref={inputRef}
      {...rest}
    />

  )
}
