import { useEffect, useRef } from 'react'
import {
  Input
} from 'antd'

export default function InputAutoFocus (props) {
  const { type, selectall = false, ...rest } = props
  const inputRef = useRef(null)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (inputRef.current) {
      const { value } = props
      if (value && selectall && isFirstRender.current) {
        inputRef.current.focus()
        inputRef.current.setSelectionRange(0, value.length)
        isFirstRender.current = false
      } else {
        inputRef.current.focus()
      }
    }
  }, [props.value, props.selectall])

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
