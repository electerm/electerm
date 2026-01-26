import { Input } from 'antd'
import InputConfirmCommon from './input-confirm-common'

const { TextArea } = Input

export default function TextareaConfirm (props) {
  return (
    <InputConfirmCommon
      {...props}
      inputComponent={TextArea}
    />
  )
}
