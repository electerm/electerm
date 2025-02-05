import { useEffect, useRef } from 'react'
import {
  Input
} from 'antd'

export default function InputAutoFocus (props) {
  const { type, selectall = false, ...rest } = props
  const inputRef = useRef(null)

  useEffect(() => {
    if (inputRef.current) {
      const { value } = props
      if (value && selectall) {
        inputRef.current.focus()
      } else {
        inputRef.current.focus()
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
