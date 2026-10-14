/**
 * bookmark form
 */
import { useState } from 'react'
import {
  Button,
  Input,
  AutoComplete,
  Form,
  Select,
  Space,
  message
} from 'antd'
import { formItemLayout } from '../../../common/form-layout'
import { uniqBy } from 'lodash-es'
import Password from '../../common/password'
import Upload, { openFileSelect } from '../../common/upload'
import HelpIcon from '../../common/help-icon'
import { sshKeyContentOrPathHelpLink } from '../../../common/constants'

const { TextArea } = Input
const FormItem = Form.Item
const e = window.translate

/**
 * A private key / certificate can be given two ways: pasted (or imported) as
 * content, or by the path of the file to read it from. One field + one button
 * each, and the path input stays out of the way until it is asked for.
 *
 * The path field is always mounted (only visually hidden) so that a saved path
 * keeps its value while the input is collapsed.
 */
function KeyField ({ name, label, desc, pathName, pathPlaceholder, form }) {
  const path = Form.useWatch(pathName, form)
  const [pathPicked, setPathPicked] = useState(false)
  const showPath = pathPicked || !!path
  const beforeUpload = async (file) => {
    const content = file.fileContent !== undefined
      ? file.fileContent
      : await window.fs.readFile(file.filePath)
    form.setFieldsValue({
      [name]: content
    })
  }
  const pickPath = async () => {
    // show the input first, so a cancelled dialog still leaves a place to
    // type the path by hand
    setPathPicked(true)
    let file
    try {
      file = await openFileSelect()
    } catch (err) {
      message.error('cannot read file: ' + err.message)
      return
    }
    if (!file) {
      return
    }
    if (file.filePath) {
      form.setFieldsValue({
        [pathName]: file.filePath
      })
    } else if (file.fileContent !== undefined) {
      // web app mode: a browser upload has no path to give, keep the content
      form.setFieldsValue({
        [name]: file.fileContent
      })
    }
  }
  return (
    <FormItem
      {...formItemLayout}
      label={e(label)}
      hasFeedback
      className='mg1b'
      rules={[{
        max: 13000, message: '13000 chars max'
      }]}
    >
      <FormItem noStyle name={name}>
        <TextArea
          placeholder={e(desc)}
          rows={1}
        />
      </FormItem>
      <Space align='center'>
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
        <Button
          type='dashed'
          className='mg2b mg1t'
          onClick={pickPath}
        >
          {e('selectFilePath')}
        </Button>
        <HelpIcon link={sshKeyContentOrPathHelpLink} />
      </Space>
      <FormItem noStyle name={pathName}>
        <Input
          className={showPath ? '' : 'hide'}
          placeholder={pathPlaceholder}
        />
      </FormItem>
    </FormItem>
  )
}

export default function renderAuth (props) {
  const {
    store,
    form,
    authType,
    formItemName = 'password',
    profileFilter = (d) => d
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
    <KeyField
      key='privateKey'
      form={form}
      name='privateKey'
      label='privateKey'
      desc='privateKeyDesc'
      pathName='privateKeyPath'
      pathPlaceholder='~/.ssh/id_rsa'
    />,
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
    <KeyField
      key='certificate'
      form={form}
      name='certificate'
      label='certificate'
      desc='certificate'
      pathName='certificatePath'
      pathPlaceholder='~/.ssh/id_rsa-cert.pub'
    />
  ]
}
