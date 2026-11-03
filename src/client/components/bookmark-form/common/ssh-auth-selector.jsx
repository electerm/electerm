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
import { KeyOutlined } from '@ant-design/icons'
import GenerateSshKeyModal from './generate-ssh-key-modal'
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
 *
 * `canGenerate` adds a "generate key" button (private key only): a key pair
 * made on the spot and saved next to the user's other keys, so that a fresh
 * server does not require leaving the app for ssh-keygen.
 */
function KeyField ({
  name,
  label,
  desc,
  pathName,
  pathPlaceholder,
  form,
  canGenerate
}) {
  const path = Form.useWatch(pathName, form)
  const [pathPicked, setPathPicked] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [generateComment, setGenerateComment] = useState('')
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
  // a key comment is a label on the far side, so the connection it was made for
  // is the most useful thing to put in it
  const openGenerate = () => {
    const username = form.getFieldValue('username')
    const host = form.getFieldValue('host')
    setGenerateComment(username && host ? `${username}@${host}` : '')
    setGenerateOpen(true)
  }
  const onGenerated = (res, passphrase) => {
    setPathPicked(true)
    form.setFieldsValue({
      // content wins over path in every read path, so a pasted key has to go
      [name]: '',
      [pathName]: res.privateKeyPath,
      ...(passphrase ? { passphrase } : {})
    })
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
      {/* three buttons plus the help icon do not fit a narrow form panel, and
          a nowrap row would push the whole panel into a horizontal scrollbar.
          The spacing lives on the container so a wrapped second row keeps the
          Space gap instead of stacking each button's own margins. */}
      <Space align='center' wrap className='mg1t mg2b'>
        <Upload
          beforeUpload={beforeUpload}
          fileList={[]}
        >
          <Button type='dashed'>
            {e('importFromFile')}
          </Button>
        </Upload>
        <Button
          type='dashed'
          onClick={pickPath}
        >
          {e('selectFilePath')}
        </Button>
        {/* the help explains content vs path, so it belongs to the path button */}
        <HelpIcon link={sshKeyContentOrPathHelpLink} />
        {canGenerate
          ? (
            <Button
              type='dashed'
              icon={<KeyOutlined />}
              onClick={openGenerate}
            >
              {e('new')} {e('privateKey')}
            </Button>
            )
          : null}
      </Space>
      <FormItem noStyle name={pathName}>
        <Input
          className={showPath ? '' : 'hide'}
          placeholder={pathPlaceholder}
        />
      </FormItem>
      {canGenerate
        ? (
          <GenerateSshKeyModal
            open={generateOpen}
            defaultComment={generateComment}
            onCancel={() => setGenerateOpen(false)}
            onGenerated={onGenerated}
          />
          )
        : null}
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
      canGenerate
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
