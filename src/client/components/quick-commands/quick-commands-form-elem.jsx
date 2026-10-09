import {
  Button,
  Form,
  Select,
  Input
} from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import message from '../common/message'
import { useState } from 'react'
import generate from '../../common/uid'
import InputAutoFocus from '../common/input-auto-focus'
import renderQm from './quick-commands-list-form'
import QuickCommandAiEditor from './quick-command-ai-editor'
import ResponsiveTabs from '../common/responsive-tabs'
import { isAIDisabled } from '../../common/ai-feature'
import ShortcutEdit from '../shortcuts/shortcut-editor'
import { getKeysTakenData } from '../shortcuts/shortcut-utils'
import deepCopy from 'json-deep-copy'
import templates from './templates'
import HelpIcon from '../common/help-icon'

const FormItem = Form.Item
const { Option } = Select
const manualTab = 'qm-form-manual'
const aiTab = 'qm-form-ai'
const e = window.translate

export default function QuickCommandForm (props) {
  const [form] = Form.useForm()
  const { store, formData } = props
  const { quickCommandTags = [] } = store
  const [shortcut, setShortcut] = useState(formData.shortcut || '')
  const [tab, setTab] = useState(manualTab)
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
  const getKeysTaken = () => {
    const keysTaken = getKeysTakenData()

    // Exclude current shortcut if editing existing command
    if (formData.shortcut) {
      delete keysTaken[formData.shortcut]
    }

    return keysTaken
  }

  async function handleSubmit (res) {
    const { formData } = props
    const {
      name,
      commands,
      labels,
      shortcut
    } = res
    // each step has its own Enter setting now, which replaces inputOnly
    const update = deepCopy({
      name,
      commands,
      inputOnly: false,
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
      // resetting the settings panel form only makes sense there; when the
      // form is hosted elsewhere (e.g. the command history modal) the caller
      // decides what happens next
      if (!props.onSaved) {
        store.setSettingItem({
          id: '',
          name: e('newQuickCommand')
        })
      }
    }
    message.success(e('saved'))
    props.onSaved?.()
  }

  // AI generated quick command: write it into the same form (so the user can
  // review/edit it) and jump back to the manual tab, where the save button is
  function handleAiGenerated (data) {
    const update = {
      name: data.name,
      commands: (data.commands || []).map(c => ({
        ...c,
        enter: !data.inputOnly
      }))
    }
    if (data.labels.length) {
      update.labels = data.labels
    }
    form.setFieldsValue(update)
    setTab(manualTab)
  }

  const initialValues = formData
  if (!initialValues.labels) {
    initialValues.labels = []
  }
  if (!initialValues.commands) {
    initialValues.commands = [{
      command: initialValues.command || '',
      id: generate(),
      // very old single-command quick commands waited 100 ms
      delay: initialValues.command ? 100 : 0
    }]
  }
  // quick commands saved before per-step Enter follow the old inputOnly
  initialValues.commands = initialValues.commands.map(c => {
    if (c.type === 'key') {
      return c
    }
    return {
      ...c,
      type: 'command',
      enter: typeof c.enter === 'boolean' ? c.enter : !initialValues.inputOnly
    }
  })
  const editorProps = {
    data: {
      name: uid,
      shortcut
    },
    keysTaken: getKeysTaken(),
    store,
    updateConfig,
    handleClear,
    renderClear: true
  }
  const templatesStr = templates.map(t => {
    return `{{${t}}}`
  }).join(', ')
  const wiki = 'https://github.com/electerm/electerm/wiki/quick-command-templates'
  const aiDisabled = isAIDisabled()
  // renderQm() uses hooks internally, so it must run on every render
  const qmItem = renderQm(form)
  const manualPane = (
    <>
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
        <InputAutoFocus />
      </FormItem>
      {qmItem}
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
      <FormItem>
        <p>
          <Button
            type='primary'
            htmlType='submit'
          >{e('save')}
          </Button>
        </p>
      </FormItem>
      <p>
        <b className='mg1r'>{e('templates')}:</b>
        <span className='mg1r'>{templatesStr}</span>
        <HelpIcon
          link={wiki}
        />
      </p>
    </>
  )
  const tabsProps = {
    activeKey: tab,
    onChange: setTab,
    className: 'qm-form-tabs',
    size: 'small',
    items: [
      {
        key: manualTab,
        label: e('quickCommand')
      },
      ...(!aiDisabled
        ? [{
            key: aiTab,
            label: (
              <span className='qm-form-tab-ai'>
                <RobotOutlined className='mg1r' />
                AI
              </span>
            )
          }]
        : [])
    ]
  }
  const aiPane = (
    <>
      <ResponsiveTabs {...tabsProps} />
      {
        tab === aiTab
          ? <QuickCommandAiEditor onChange={handleAiGenerated} />
          : manualPane
      }
    </>
  )
  return (
    <>
      <Form
        form={form}
        onFinish={handleSubmit}
        className='form-wrap pd2l'
        layout='vertical'
        initialValues={initialValues}
      >
        {aiDisabled ? manualPane : aiPane}
      </Form>
    </>
  )
}
