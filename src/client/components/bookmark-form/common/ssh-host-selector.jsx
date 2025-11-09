import { Form } from 'antd'
import InputAutoFocus from '../../common/input-auto-focus.jsx'
import { ColorPickerItem } from './color-picker-item.jsx'
import { formItemLayout } from '../../../common/form-layout.js'

const FormItem = Form.Item
const e = window.translate

export default function SshHostSelector ({ ips = [], useIp, form, onBlur, onPaste, trim, ...props }) {
  // ips is ipaddress string[]
  function renderIps () {
    return ips.map(ip => {
      return (
        <div
          key={ip}
          className='iblock mg2r pointer ip-item'
          onClick={() => useIp(form, ip)}
        >
          <b>{ip}</b>
          <span
            className='mg1l item-item-use'
          >
            {e('use')}
          </span>
        </div>
      )
    })
  }

  return (
    <FormItem
      {...formItemLayout}
      label={e('host')}
      hasFeedback
      rules={[{
        max: 520, message: '520 chars max'
      }, {
        required: true, message: 'host required'
      }]}
      normalize={props.trim}
    >
      {
        ips.length
          ? renderIps()
          : (
            <div className='dns-section'>
              hostname or ip
            </div>
            )
      }
      <FormItem noStyle name='host'>
        <InputAutoFocus
          name='host'
          onBlur={props.onBlur}
          onPaste={e => props.onPaste(e, form)}
          addonBefore={<ColorPickerItem />}
        />
      </FormItem>
    </FormItem>
  )
}
