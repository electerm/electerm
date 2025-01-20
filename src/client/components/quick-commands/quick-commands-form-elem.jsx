import {
  Button,
  Switch,
  Form,
  message,
  Select,
  Input
} from 'antd'
import { useState } from 'react'
import generate from '../../common/uid'
import InputAutoFocus from '../common/input-auto-focus'
import renderQm from './quick-commands-list-form'
import ShortcutEdit from '../shortcuts/shortcut-editor'
import shortcutsDefaultsGen from '../shortcuts/shortcuts-defaults'
import deepCopy from 'json-deep-copy'
import {
  isMacJs as isMac
} from '../../common/constants.js'

const FormItem = Form.Item
const { Option } = Select
const e = window.translate
const shortcutsDefaults = shortcutsDefaultsGen()

export default function QuickCommandForm (props) {
  const [form] = Form.useForm()
  const { store, formData } = props
  const { quickCommandTags = [] } = store
  const [shortcut, setShortcut] = useState(formData.shortcut || '')
  const uid = formData.id || generate()
  const updateConfig = (name, value) => {
    form.setFieldsValue({
      shortcut: value
    })
    setShortcut(value)
  }
  const handleClear = () => {
    form.setFieldsValue({
      shortcut: ''
    })
    setShortcut('')
  }
  const getKeysTakenData = () => {
    const { shortcuts = {} } = store.config
    const { quickCommands = [] } = store

    // Gather system shortcuts
    const systemShortcuts = shortcutsDefaults.reduce((p, k) => {
      const propName = isMac ? 'shortcutMac' : 'shortcut'
      const name = k.name + '_' + propName
      const vv = k.readonly ? k[propName] : (shortcuts[name] || k[propName])
      const v = vv
        .split(',')
        .map(f => f.trim())
        .reduce((p, k) => ({
          ...p,
          [k]: true
        }), {})
      return {
        ...p,
        ...v
      }
    }, {})

    // Gather quick command shortcuts
    const quickCommandShortcuts = quickCommands.reduce((acc, command) => {
      if (command.shortcut) {
        acc[command.shortcut] = true
      }
      return acc
    }, {})

    // Combine system shortcuts and quick command shortcuts
    return {
      ...systemShortcuts,
      ...quickCommandShortcuts
    }
  }

  async function handleSubmit (res) {
    const { formData } = props
    const {
      name,
      commands,
      inputOnly,
      labels,
      shortcut
    } = res
    const update = deepCopy({
      name,
      commands,
      inputOnly,
      labels,
      shortcut
    })
    const update1 = {
      ...update,
      id: uid
    }
    if (formData.id) {
      store.editQuickCommand(formData.id, update)
    } else {
      store.addQuickCommand(update1)
      store.setSettingItem({
        id: '',
        name: e('newQuickCommand')
      })
    }
    message.success(e('saved'))
  }
  const initialValues = formData
  if (!initialValues.labels) {
    initialValues.labels = []
  }
  if (!initialValues.commands) {
    initialValues.commands = [{
      command: initialValues.command || '',
      id: generate(),
      delay: 100
    }]
  }
  const editorProps = {
    data: {
      name: uid,
      shortcut
    },
    keysTaken: getKeysTakenData(),
    store,
    updateConfig,
    handleClear,
    renderClear: true
  }
  return (
    <Form
      form={form}
      onFinish={handleSubmit}
      className='form-wrap pd2l'
      layout='vertical'
      initialValues={initialValues}
    >
      <FormItem
        label={e('quickCommandName')}
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
      {renderQm()}
      <FormItem
        name='labels'
        label={e('label')}
      >
        <Select
          mode='tags'
        >
          {
            quickCommandTags.map(q => {
              return (
                <Option value={q} key={'qmt-' + q}>
                  {q}
                </Option>
              )
            })
          }
        </Select>
      </FormItem>
      <FormItem
        label={e('settingShortcuts')}
        name='shortcut'
      >
        <div>
          <Input className='hide' />
          <ShortcutEdit
            {...editorProps}
          />
        </div>
      </FormItem>
      <FormItem
        label={e('inputOnly')}
        name='inputOnly'
        valuePropName='checked'
      >
        <Switch />
      </FormItem>
      <FormItem>
        <p>
          <Button
            type='primary'
            htmlType='submit'
          >{e('save')}
          </Button>
        </p>
      </FormItem>
    </Form>
  )
}
