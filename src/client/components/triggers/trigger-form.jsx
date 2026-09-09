/**
 * Single trigger rule form (used inside a Modal by TriggerEditor).
 * Controlled via antd Form, initialValues = editing rule.
 */
import { useEffect } from 'react'
import {
  Button,
  Dropdown,
  Form,
  Input,
  Switch,
  Select,
  InputNumber,
  Radio
} from 'antd'
import { CaretDownOutlined } from '@ant-design/icons'
import {
  triggerActionTypes,
  triggerMatchTypes,
  triggerModes,
  triggerPresets
} from '../terminal/automation/trigger-presets.js'
import uid from '../../common/uid'

const e = window.translate

// Build a full trigger rule from form values. `editing` is the rule being
// edited (or a {id:''} placeholder for a new one).
export function buildTriggerFromFormValues (editing = {}, v) {
  return {
    ...(editing.id ? editing : {}),
    id: editing.id || uid(),
    name: v.name,
    enabled: v.enabled !== false,
    match: {
      type: v.matchType,
      value: v.matchValue,
      caseSensitive: !!v.caseSensitive
    },
    action: {
      type: v.actionType,
      value: v.actionType === 'notify' ? '' : (v.actionValue || '')
    },
    sendEnter: v.sendEnter !== false,
    mode: v.mode,
    // Keep the value while another mode is selected so switching back to
    // cooldown does not silently replace the user's interval.
    cooldownMs: v.cooldownMs == null ? 500 : v.cooldownMs
  }
}

export default function TriggerForm ({ form, initial }) {
  const actionType = Form.useWatch('actionType', form)
  const mode = Form.useWatch('mode', form)

  useEffect(() => {
    form.resetFields()
    form.setFieldsValue({
      name: initial.name || '',
      enabled: initial.enabled !== false,
      matchType: initial.match?.type || 'text',
      matchValue: initial.match?.value || '',
      caseSensitive: !!initial.match?.caseSensitive,
      actionType: initial.action?.type || 'send',
      actionValue: initial.action?.value || '',
      sendEnter: initial.sendEnter !== false,
      mode: initial.mode || 'cooldown',
      cooldownMs: initial.cooldownMs == null ? 500 : initial.cooldownMs
    })
  }, [form, initial])

  const presetMenu = {
    items: triggerPresets.map((p, i) => ({
      key: String(i),
      label: p.name
    })),
    onClick: ({ key }) => {
      const p = triggerPresets[Number(key)]
      if (!p) {
        return
      }
      form.setFieldsValue({
        name: p.name,
        enabled: true,
        matchType: p.match.type,
        matchValue: p.match.value,
        caseSensitive: !!p.match.caseSensitive,
        actionType: p.action.type,
        actionValue: p.action.value,
        sendEnter: p.sendEnter !== false,
        mode: p.mode || 'cooldown',
        cooldownMs: p.cooldownMs == null ? 500 : p.cooldownMs
      })
    }
  }

  return (
    <Form
      form={form}
      layout='vertical'
    >
      <div className='pd1b alignright'>
        <Dropdown menu={presetMenu} trigger={['click']}>
          <Button icon={<CaretDownOutlined />}>
            {e('presets')}
          </Button>
        </Dropdown>
      </div>
      <Form.Item
        name='name'
        label={e('title')}
        rules={[{ required: true, message: e('title') + ' required' }]}
      >
        <Input placeholder='Cisco --More-- auto pager' />
      </Form.Item>
      <Form.Item
        name='enabled'
        label={e('enabled')}
        valuePropName='checked'
      >
        <Switch />
      </Form.Item>
      <Form.Item label='Match'>
        <div style={{ display: 'flex', gap: 8 }}>
          <Form.Item name='matchType' noStyle>
            <Radio.Group
              options={triggerMatchTypes.map(t => ({ label: t.label, value: t.value }))}
              optionType='button'
              buttonStyle='solid'
              size='small'
            />
          </Form.Item>
          <Form.Item
            name='matchValue'
            noStyle
            rules={[{ required: true, message: 'match required' }]}
          >
            <Input
              placeholder='--More-- or press any key.*'
              style={{ flex: 1 }}
            />
          </Form.Item>
        </div>
      </Form.Item>
      <Form.Item
        name='caseSensitive'
        label='Case sensitive'
        valuePropName='checked'
      >
        <Switch size='small' />
      </Form.Item>
      <Form.Item label='Action'>
        <div style={{ display: 'flex', gap: 8 }}>
          <Form.Item name='actionType' noStyle>
            <Select
              style={{ width: 130 }}
              options={triggerActionTypes.map(t => ({ label: t.label, value: t.value }))}
            />
          </Form.Item>
          <Form.Item name='actionValue' noStyle>
            <Input
              placeholder={actionType === 'notify' ? 'Notify only (no send)' : 'space, y, \\r, \\x03, ^M'}
              style={{ flex: 1 }}
              disabled={actionType === 'notify'}
            />
          </Form.Item>
        </div>
      </Form.Item>
      <div style={{ display: 'flex', gap: 24 }}>
        <Form.Item
          name='sendEnter'
          label='Send Enter'
          valuePropName='checked'
        >
          <Switch size='small' disabled={actionType === 'notify'} />
        </Form.Item>
        <Form.Item
          name='mode'
          label={e('mode')}
        >
          <Select
            style={{ width: 190 }}
            options={triggerModes.map(t => ({ label: t.label, value: t.value }))}
          />
        </Form.Item>
        <Form.Item
          name='cooldownMs'
          label='Cooldown (ms)'
        >
          <InputNumber
            min={0}
            max={600000}
            step={100}
            disabled={mode !== 'cooldown'}
          />
        </Form.Item>
      </div>
    </Form>
  )
}
