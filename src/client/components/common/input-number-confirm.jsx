import { InputNumber } from 'antd'
import InputConfirmCommon from './input-confirm-common'

export default function InputNumberConfirm (props) {
  return (
    <InputConfirmCommon
      {...props}
      inputComponent={InputNumber}
    />
  )
}
