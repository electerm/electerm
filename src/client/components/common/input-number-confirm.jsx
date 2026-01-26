import { InputNumber } from 'antd'
import InputConfirmCommon from './input-confirm-common'

export default function InputNumberConfirm (props) {
  const { addonAfter, ...rest } = props
  return (
    <InputConfirmCommon
      {...rest}
      inputComponent={InputNumber}
      extraAddonAfter={addonAfter}
    />
  )
}
