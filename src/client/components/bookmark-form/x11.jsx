/**
 * bookmark form
 */
import {
  Switch,
  Form,
  Button,
  Select
} from 'antd'
import { formItemLayout } from '../../common/form-layout'

const FormItem = Form.Item
const { Option } = Select

// Available cipher options from ssh2-alg.js
const cipherOptions = [
  'aes128-ctr',
  'aes192-ctr',
  'aes256-ctr',
  'aes128-gcm',
  'aes128-gcm@openssh.com',
  'aes256-gcm',
  'aes256-gcm@openssh.com',
  'aes256-cbc',
  'aes192-cbc',
  'aes128-cbc',
  'blowfish-cbc',
  '3des-cbc',
  'arcfour256',
  'arcfour128',
  'cast128-cbc',
  'arcfour',
  'chacha20-poly1305@openssh.com',
  'umac-128-etm@openssh.com',
  'curve25519-sha256@libssh.org'
]

// Available serverHostKey options from ssh2-alg.js
const serverHostKeyOptions = [
  'ssh-rsa',
  'ssh-ed25519',
  'ecdsa-sha2-nistp256',
  'ecdsa-sha2-nistp384',
  'ecdsa-sha2-nistp521',
  'ssh-dss',
  'rsa-sha2-512',
  'rsa-sha2-256'
]

const defaultCipherOptions = [
  'aes128-ctr',
  'aes192-ctr',
  'aes256-ctr',
  'aes128-gcm',
  'aes128-gcm@openssh.com',
  'aes256-gcm',
  'aes256-gcm@openssh.com',
  'aes256-cbc',
  'aes192-cbc',
  'aes128-cbc',
  'blowfish-cbc',
  '3des-cbc',
  'arcfour256',
  'arcfour128',
  'cast128-cbc',
  'arcfour'
]

const defaultServerHostKeyOptions = [
  'ssh-rsa',
  'ssh-ed25519',
  'ecdsa-sha2-nistp256',
  'ecdsa-sha2-nistp384',
  'ecdsa-sha2-nistp521',
  'ssh-dss',
  'rsa-sha2-512',
  'rsa-sha2-256'
]

export default function renderX11 (form) {
  function setDefaults () {
    form.setFieldValue('cipher', defaultCipherOptions)
    form.setFieldValue('serverHostKey', defaultServerHostKeyOptions)
  }
  return (
    <>
      <FormItem
        {...formItemLayout}
        label='cipher'
        name='cipher'
      >
        <Select
          mode='tags'
          style={{ width: '100%' }}
        >
          {cipherOptions.map(cipher => (
            <Option key={cipher} value={cipher}>{cipher}</Option>
          ))}
        </Select>
      </FormItem>
      <FormItem
        {...formItemLayout}
        label='serverHostKey'
      >
        <FormItem
          {...formItemLayout}
          noStyle
          name='serverHostKey'
        >
          <Select
            mode='tags'
            style={{ width: '100%' }}
          >
            {serverHostKeyOptions.map(key => (
              <Option key={key} value={key}>{key}</Option>
            ))}
          </Select>
        </FormItem>
        <div className='mg1t'>
          <Button
            type='dashed'
            onClick={setDefaults}
            size='small'
          >
            Set default cipher and serverHostKey
          </Button>
        </div>
      </FormItem>
      <FormItem
        {...formItemLayout}
        label='x11'
        name='x11'
        valuePropName='checked'
      >
        <Switch />
      </FormItem>
    </>
  )
}
