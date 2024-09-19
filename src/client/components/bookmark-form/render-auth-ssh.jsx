/**
 * bookmark form
 */
import {
  Button,
  Input,
  Upload,
  AutoComplete,
  Form,
  Select
} from 'antd'
import { formItemLayout } from '../../common/form-layout'
import { uniqBy } from 'lodash-es'
import './bookmark-form.styl'

const { TextArea } = Input
const FormItem = Form.Item
const e = window.translate

export default function renderAuth (props) {
  const {
    store,
    form,
    authType,
    formItemName = 'password',
    profileFilter = (d) => d
  } = props
  const beforeUpload = async (file) => {
    const privateKey = await window.fs.readFile(file.path)
    form.setFieldsValue({
      privateKey
    })
    return false
  }
  if (authType === 'password') {
    const opts = {
      options: uniqBy(
        store.bookmarks
          .filter(d => d.password),
        (d) => d.password
      )
        .map(d => {
          return {
            label: `${d.title ? `(${d.title})` : ''}${d.username || ''}:${d.host}-******`,
            value: d.password
          }
        }),
      placeholder: e('password'),
      allowClear: false
    }
    return (
      <FormItem
        {...formItemLayout}
        label={e('password')}
        name={formItemName}
        hasFeedback
        rules={[{
          max: 1024, message: '1024 chars max'
        }]}
      >
        <AutoComplete
          {...opts}
        >
          <Input.Password />
        </AutoComplete>
      </FormItem>
    )
  }
  if (authType === 'profiles') {
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
  return [
    <FormItem
      {...formItemLayout}
      label={e('privateKey')}
      hasFeedback
      key='privateKey'
      className='mg1b'
      rules={[{
        max: 13000, message: '13000 chars max'
      }]}
    >
      <FormItem noStyle name='privateKey'>
        <TextArea
          placeholder={e('privateKeyDesc')}
          autoSize={{ minRows: 1 }}
        />
      </FormItem>
      <Upload
        beforeUpload={beforeUpload}
        fileList={[]}
      >
        <Button
          type='dashed'
          className='mg2b mg1t'
        >
          {e('importFromFile')}
        </Button>
      </Upload>
    </FormItem>,
    <FormItem
      key='passphrase'
      {...formItemLayout}
      label={e('passphrase')}
      name='passphrase'
      hasFeedback
      rules={[{
        max: 1024, message: '1024 chars max'
      }]}
    >
      <Input.Password
        placeholder={e('passphraseDesc')}
      />
    </FormItem>
  ]
}
