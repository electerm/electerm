import { Input } from 'antd'
import InputConfirmCommon from './input-confirm-common'

export default function InputConfirm (props) {
  const { extraAddonAfter, ...rest } = props
  return (
    <InputConfirmCommon
      {...rest}
      inputComponent={Input}
      extraAddonAfter={extraAddonAfter}
    />
  )
}
