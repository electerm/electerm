import {
  Form,
  message,
  Button,
  Input
} from 'antd'
import InputAutoFocus from '../common/input-auto-focus'
import renderAuth from '../bookmark-form/render-auth-ssh'
import { formItemLayout } from '../../common/form-layout'
import {
  settingMap
} from '../../common/constants'
const FormItem = Form.Item
const { prefix } = window
const e = prefix('form')
const s = prefix('setting')
const ss = prefix('sftp')

export default function QuickCommandForm (props) {
  const [form] = Form.useForm()
  const { autofocustrigger, profiles } = props.store
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
    message.success(s('saved'))
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
          autofocustrigger={autofocustrigger}
        />
      </FormItem>
      <FormItem
        {...formItemLayout}
        label={e('username')}
        hasFeedback
        name='username'
        rules={[{
          max: 128, message: '128 chars max'
        }]}
      >
        <Input />
      </FormItem>
      {
        renderAuth({
          store: props.store,
          form,
          authType: 'password'
        })
      }
      {
        renderAuth({
          store: props.store,
          form
        })
      }
      <FormItem>
        <Button
          type='primary'
          htmlType='submit'
        >
          {ss('submit')}
        </Button>
      </FormItem>
    </Form>
  )
}
