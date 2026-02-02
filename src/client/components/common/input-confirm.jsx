import { Input } from 'antd'
import InputConfirmCommon from './input-confirm-common'

export default function InputConfirm (props) {
  return (
    <InputConfirmCommon
      {...props}
      inputComponent={Input}
    />
  )
}
