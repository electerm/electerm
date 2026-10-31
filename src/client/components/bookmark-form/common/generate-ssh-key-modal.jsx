/**
 * Generate an ssh key pair on the machine the session will read it from and
 * save it next to the user's other keys (~/.ssh by default), then hand the
 * private key path back to the bookmark form.
 */
import { useState, useEffect } from 'react'
import {
  Form,
  Input,
  Select,
  Button,
  Space,
  Alert
} from 'antd'
import {
  FolderOpenOutlined,
  CopyOutlined
} from '@ant-design/icons'
import Modal from '../../common/modal'
import Password from '../../common/password'
import message from '../../common/message'
import { formItemLayout } from '../../../common/form-layout'
import { chooseSaveDirectory } from '../../../common/choose-save-folder'
import { copy } from '../../../common/clipboard'

const FormItem = Form.Item
const e = window.translate

/**
 * "new ssh key" is not assembled from existing keys on purpose: `key` is the
 * *keyboard* key in 13 of 15 locales ("Taste", "tecla", "touche", "按键",
 * "按鍵", "клавиша", "klawisz", "tombol", "tuş"), and `newSsh` reads "new SSH
 * connection" in ar/fr/ru/zh_tw/hu, so the parts do not add up. Plain English
 * costs no locale entry and anyone generating an ssh key reads it.
 */

export const sshKeyTypes = [
  { value: 'ed25519', label: 'Ed25519', bits: null },
  { value: 'rsa', label: 'RSA', bits: [2048, 3072, 4096], defaultBits: 4096 },
  { value: 'ecdsa', label: 'ECDSA', bits: [256, 384, 521], defaultBits: 256 }
]

export const defaultKeyFileName = {
  ed25519: 'id_ed25519',
  rsa: 'id_rsa',
  ecdsa: 'id_ecdsa'
}

const defaultDir = '~/.ssh'
const isAbsolute = (p) => /^(\/|[A-Za-z]:[\\/])/.test(p || '')

export default function GenerateSshKeyModal (props) {
  const {
    open,
    onCancel,
    onGenerated,
    defaultComment
  } = props
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const type = Form.useWatch('type', form) || 'ed25519'
  const typeOpt = sshKeyTypes.find(d => d.value === type) || sshKeyTypes[0]

  // the modal unmounts its children when closed, so `initialValues` is re-read
  // on every open -- the previous key's fields never linger
  const initialValues = {
    type: 'ed25519',
    dir: defaultDir,
    fileName: defaultKeyFileName.ed25519,
    comment: defaultComment || ''
  }

  useEffect(() => {
    if (open) {
      setResult(null)
      setLoading(false)
    }
  }, [open])

  function onValuesChange (changed) {
    if (!('type' in changed)) {
      return
    }
    const next = sshKeyTypes.find(d => d.value === changed.type) || sshKeyTypes[0]
    const update = { bits: next.defaultBits }
    const fileName = form.getFieldValue('fileName')
    // only follow the type when the name is still one we generated
    if (!fileName || Object.values(defaultKeyFileName).includes(fileName)) {
      update.fileName = defaultKeyFileName[next.value]
    }
    form.setFieldsValue(update)
  }

  async function pickDir () {
    const dir = form.getFieldValue('dir')
    try {
      const picked = await chooseSaveDirectory(
        // Electron cannot expand `~`, so only offer it as a starting point when
        // it is already a real path
        isAbsolute(dir) ? { defaultPath: dir } : {}
      )
      if (picked) {
        form.setFieldsValue({ dir: picked })
      }
    } catch (err) {
      message.error(err.message)
    }
  }

  async function generate () {
    const values = await form.validateFields().catch(() => null)
    if (!values) {
      return
    }
    setLoading(true)
    try {
      const res = await window.fs.generateSshKeyPair({
        type: values.type,
        bits: values.bits,
        dir: values.dir,
        fileName: values.fileName,
        comment: values.comment,
        passphrase: values.passphrase || ''
      })
      setResult(res)
      if (onGenerated) {
        onGenerated(res, values.passphrase || '')
      }
    } catch (err) {
      message.error(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  function copyPublicKey () {
    copy(result.publicKey)
  }

  function copyPrivateKey () {
    copy(result.privateKey)
  }

  function copyPrivateKeyPath () {
    copy(result.privateKeyPath)
  }

  function renderForm () {
    return (
      <Form
        form={form}
        name='generate-ssh-key-form'
        initialValues={initialValues}
        onValuesChange={onValuesChange}
        {...formItemLayout}
      >
        <FormItem label={e('type')} name='type'>
          <Select options={sshKeyTypes.map(d => ({ value: d.value, label: d.label }))} />
        </FormItem>
        {typeOpt.bits
          ? (
            <FormItem label={e('size')} name='bits'>
              <Select
                options={typeOpt.bits.map(b => ({ value: b, label: String(b) }))}
              />
            </FormItem>
            )
          : null}
        <FormItem
          label={e('folder')}
          name='dir'
          rules={[{ required: true, message: e('required') }]}
        >
          <Input
            placeholder={defaultDir}
            addonAfter={(
              <Button
                type='text'
                size='small'
                icon={<FolderOpenOutlined />}
                onClick={pickDir}
              />
            )}
          />
        </FormItem>
        <FormItem
          label={e('name')}
          name='fileName'
          rules={[{ required: true, message: e('required') }]}
        >
          <Input placeholder={defaultKeyFileName.ed25519} />
        </FormItem>
        <FormItem
          label={e('passphrase')}
          name='passphrase'
          rules={[{ max: 1024, message: '1024 chars max' }]}
        >
          <Password placeholder={e('passphraseDesc')} />
        </FormItem>
        <FormItem
          // no `confirm` key exists on its own (only `ok`), and gluing an English
          // fragment onto a translated `passphrase` reads worse than plain English
          label={e('passphrase') + ':' + e('repeat')}
          name='passphraseConfirm'
          dependencies={['passphrase']}
          rules={[
            ({ getFieldValue }) => ({
              validator (_, value) {
                if (!value || value === getFieldValue('passphrase')) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('passphrases do not match'))
              }
            })
          ]}
        >
          <Password />
        </FormItem>
        {/* the key's comment is stored inside the key and shows up as the label
            in authorized_keys, so "description" says exactly what it is */}
        <FormItem label={e('description')} name='comment'>
          <Input />
        </FormItem>
      </Form>
    )
  }

  function renderResult () {
    return (
      <div>
        <Alert
          type='success'
          showIcon
          message={e('saved')}
        />
        {/* private key: the path to use in "select file path", and the content
            for anyone who wants it pasted into the privateKey field instead */}
        <div className='mg2t'>
          <div className='pd1b'>
            {e('privateKey')}
          </div>
          <Space.Compact block>
            <Input
              readOnly
              value={result.privateKeyPath}
              onFocus={(evt) => evt.target.select()}
            />
            <Button
              icon={<CopyOutlined />}
              onClick={copyPrivateKeyPath}
            >
              {e('copyFilePath')}
            </Button>
          </Space.Compact>
          <Button
            className='mg1t'
            type='dashed'
            icon={<CopyOutlined />}
            onClick={copyPrivateKey}
          >
            {e('copy')} {e('privateKey')}
          </Button>
        </div>
        <div className='mg2t'>
          <div className='pd1b'>
            {e('publicKey')}
          </div>
          <Input.TextArea
            readOnly
            rows={3}
            value={result.publicKey}
            onFocus={(evt) => evt.target.select()}
          />
          <Button
            className='mg1t'
            icon={<CopyOutlined />}
            onClick={copyPublicKey}
          >
            {e('copy')} {e('publicKey')}
          </Button>
        </div>
      </div>
    )
  }
  const title = e('new') + ' ' + e('privateKey')
  const modalProps = {
    open,
    title,
    width: 560,
    onCancel,
    footer: result
      ? (
        <div className='custom-modal-footer-buttons'>
          <Button type='primary' onClick={onCancel}>
            {e('close')}
          </Button>
        </div>
        )
      : (
        <div className='custom-modal-footer-buttons'>
          <Button onClick={onCancel}>
            {e('cancel')}
          </Button>
          <Button
            type='primary'
            loading={loading}
            onClick={generate}
          >
            {e('submit')}
          </Button>
        </div>
        )
  }

  return (
    <Modal {...modalProps}>
      {result ? renderResult() : renderForm()}
    </Modal>
  )
}
