/**
 * bookmark form
 */
import {
  Button,
  Input,
  AutoComplete,
  Form,
  Select
} from 'antd'
import { formItemLayout } from '../../../common/form-layout'
import { uniqBy } from 'lodash-es'
import Password from '../../common/password'
import Upload from '../../common/upload'

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
  const commonBeforeUpload = (fieldName) => async (file) => {
    const filePath = file.filePath
    const content = await window.fs.readFile(filePath)
    form.setFieldsValue({
      [fieldName]: content
    })
  }
  const renderKeyField = (key, label, desc) => (
    <FormItem
      {...formItemLayout}
      label={e(label)}
      hasFeedback
      key={key}
      className='mg1b'
      rules={[{
        max: 13000, message: '13000 chars max'
      }]}
    >
      <FormItem noStyle name={key}>
        <TextArea
          placeholder={e(desc)}
          autoSize={{ minRows: 1 }}
        />
      </FormItem>
      <Upload
        beforeUpload={commonBeforeUpload(key)}
        fileList={[]}
      >
        <Button
          type='dashed'
          className='mg2b mg1t'
        >
          {e('importFromFile')}
        </Button>
      </Upload>
    </FormItem>
  )
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
          <Password />
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
    renderKeyField('privateKey', 'privateKey', 'privateKeyDesc'),
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
      <Password
        placeholder={e('passphraseDesc')}
      />
    </FormItem>,
    renderKeyField('certificate', 'certificate', 'certificate')
  ]
}
