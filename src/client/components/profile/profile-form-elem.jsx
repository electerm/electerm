import { useState } from 'react'
import {
  Form,
  message,
  Button
} from 'antd'
import InputAutoFocus from '../common/input-auto-focus'
import { formItemLayout } from '../../common/form-layout'
import {
  settingMap
} from '../../common/constants'

import ProfileTabs from './profile-tabs'

const FormItem = Form.Item
const e = window.translate

export default function ProfileFormElem (props) {
  const [form] = Form.useForm()
  const [activeTab, setActiveTab] = useState('ssh')
  const { profiles } = props.store
  function genId () {
    let count = profiles.length ? profiles.length : ''
    let id = 'PROFILE' + count
    while (profiles.find(d => d.id === id)) {
      count = count + 1
      id = 'PROFILE' + count
    }
    return id
  }
  async function handleSubmit (res) {
    const { formData } = props
    const update1 = {
      ...res,
      id: genId()
    }
    if (formData.id) {
      props.store.editItem(formData.id, res, settingMap.profiles)
    } else {
      props.store.addItem(update1, settingMap.profiles)
      props.store.setSettingItem({
        id: '',
        name: e('profile')
      })
    }
    message.success(e('saved'))
  }
  const tabsProps = {
    activeTab,
    onChangeTab: setActiveTab,
    form,
    store: props.store
  }
  return (
    <Form
      form={form}
      onFinish={handleSubmit}
      className='form-wrap pd2l'
      layout='vertical'
      initialValues={props.formData}
    >
      <p>ID: {props.formData.id || genId()}</p>
      <FormItem
        label={e('profileName')}
        {...formItemLayout}
        rules={[{
          max: 60, message: '60 chars max'
        }, {
          required: true, message: 'Name required'
        }]}
        hasFeedback
        name='name'
      >
        <InputAutoFocus
          selectall='yes'
        />
      </FormItem>
      <ProfileTabs {...tabsProps} />
      <FormItem>
        <Button
          type='primary'
          htmlType='submit'
        >
          {e('submit')}
        </Button>
      </FormItem>
    </Form>
  )
}
