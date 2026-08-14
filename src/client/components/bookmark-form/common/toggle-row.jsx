import { Form } from 'antd'
import classnames from 'classnames'
import SwitchLabel from '../../common/switch.jsx'

const FormItem = Form.Item

export default function ToggleRow ({ name, title, description, badge, form, valuePropName = 'checked' }) {
  const checked = Form.useWatch(name, form)
  return (
    <div className='settings-toggle-row'>
      <FormItem name={name} valuePropName={valuePropName} noStyle>
        <SwitchLabel />
      </FormItem>
      <div className='settings-toggle-text'>
        <div className='settings-toggle-title'>{title}</div>
        {description ? <div className='settings-toggle-desc'>{description}</div> : null}
      </div>
      {
        badge
          ? (
            <span className={classnames('settings-toggle-badge', { 'is-on': checked })}>
              {checked ? 'enabled' : 'disabled'}
            </span>
            )
          : null
      }
    </div>
  )
}
