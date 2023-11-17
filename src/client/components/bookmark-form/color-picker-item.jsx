import {
  Form
} from 'antd'
import { ColorPicker } from './color-picker.jsx'

const FormItem = Form.Item

export function ColorPickerItem () {
  return (
    <FormItem name='color' noStyle>
      <ColorPicker />
    </FormItem>
  )
}
