/**
 * Appearance field of a bookmark form: one button that opens the colour / icon
 * tabs.
 *
 * Rendered as the prefix of the title field (`colorTitle` in the form configs),
 * so every session type gets the same control. `color` and `icon` are
 * registered here because they are not regular form fields: they belong to the
 * bookmark, the user never types them.
 */

import { Form, Input } from 'antd'
import AppearancePicker from '../../common/appearance-picker.jsx'

const FormItem = Form.Item

export function ColorPickerItem () {
  const form = Form.useFormInstance()
  const color = Form.useWatch('color', form)
  const icon = Form.useWatch('icon', form)

  return (
    <>
      <FormItem name='color' hidden><Input /></FormItem>
      <FormItem name='icon' hidden><Input /></FormItem>
      <AppearancePicker
        color={color}
        icon={icon}
        onColorChange={value => form.setFieldsValue({ color: value })}
        onIconChange={value => form.setFieldsValue({ icon: value })}
      />
    </>
  )
}
