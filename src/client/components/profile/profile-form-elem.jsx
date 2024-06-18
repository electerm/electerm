import {
  Form,
  message,
  Button
} from 'antd'
import generate from '../../common/uid'
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
  const { autofocustrigger } = props.store
  async function handleSubmit (res) {
    const { formData } = props
    const update1 = {
      ...res,
      id: generate()
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
