import { Button, Form } from 'antd'
import SettingCol from './col'
import TriggerSettingList from '../triggers/trigger-setting-list'
import TriggerForm, { buildTriggerFromFormValues } from '../triggers/trigger-form'
import { validateTriggers } from '../terminal/automation/trigger-engine'
import message from '../common/message'
import { settingMap } from '../../common/constants'

const e = window.translate

export default function TabTriggers (props) {
  const {
    settingTab,
    store,
    settingItem,
    listProps
  } = props
  if (settingTab !== settingMap.triggers) {
    return null
  }
  const [form] = Form.useForm()

  const handleSave = async () => {
    try {
      const v = await form.validateFields()
      const next = buildTriggerFromFormValues(settingItem, v)
      const errors = validateTriggers([next])
      if (errors.length) {
        message.error(errors[0])
        return
      }
      if (settingItem.id) {
        store.editTrigger(settingItem.id, next)
      } else {
        store.addTrigger(next)
        store.setSettingItem({
          id: '',
          name: settingMap.triggers
        })
      }
      message.success(e('saved'))
    } catch (err) {
      // validation failed, keep form as is
    }
  }

  return (
    <div
      className='setting-tabs-triggers'
    >
      <SettingCol>
        <TriggerSettingList
          {...listProps}
        />
        <div key={settingItem.id}>
          <TriggerForm
            form={form}
            initial={settingItem}
          />
          <div className='pd2l'>
            <Button
              type='primary'
              onClick={handleSave}
            >
              {e('save')}
            </Button>
          </div>
        </div>
      </SettingCol>
    </div>
  )
}
