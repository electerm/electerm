/**
 * bookmark form
 */
import {
  Button,
  Input,
  Upload,
  AutoComplete,
  Form
} from 'antd'
import { formItemLayout } from '../../common/form-layout'
import { uniqBy } from 'lodash-es'
import './bookmark-form.styl'

const { TextArea } = Input
const FormItem = Form.Item
const { prefix } = window
const e = prefix('form')

export default function renderAuth (props) {
  const {
    store,
    form,
    authType
  } = props
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
        name='password'
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
          rows={1}
        />
      </FormItem>
      <Upload
        beforeUpload={file => props.beforeUpload(file, form)}
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
