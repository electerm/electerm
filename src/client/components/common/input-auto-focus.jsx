import { useEffect, useRef } from 'react'
import {
  Input
} from 'antd'

export default function InputAutoFocus (props) {
  const { type, ...rest } = props
  const inputRef = useRef(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [props.value])

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
