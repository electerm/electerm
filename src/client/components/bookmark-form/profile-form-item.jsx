/**
 * bookmark form
 */
import {
  Form,
  Select
} from 'antd'
import { formItemLayout } from '../../common/form-layout'
import './bookmark-form.styl'

const FormItem = Form.Item
const e = window.translate

export default function ProfileItem (props) {
  const {
    store,
    profileFilter = (d) => d
  } = props
  const opts = {
    options: store.profiles
      .filter(profileFilter)
      .map(d => {
        return {
          label: d.name,
          value: d.id
        }
      }),
    placeholder: e('profiles'),
    allowClear: true
  }
  return (
    <FormItem
      {...formItemLayout}
      label={e('profiles')}
      name='profile'
      hasFeedback
    >
      <Select
        {...opts}
      />
    </FormItem>
  )
}
