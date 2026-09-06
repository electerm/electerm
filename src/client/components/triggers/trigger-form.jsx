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
import { te as e } from './trigger-lang.js'
import uid from '../../common/uid'

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
    cooldownMs: v.mode === 'cooldown' ? (v.cooldownMs == null ? 500 : v.cooldownMs) : 0
  }
}

export default function TriggerForm ({ form, initial }) {
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
    // eslint-disable-next-line
  }, [initial])

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
      preserve={false}
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
      <Form.Item label={e('triggerMatch')}>
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
        label={e('caseSensitive')}
        valuePropName='checked'
      >
        <Switch size='small' />
      </Form.Item>
      <Form.Item label={e('triggerAction')}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Form.Item name='actionType' noStyle>
            <Select
              style={{ width: 130 }}
              options={triggerActionTypes.map(t => ({ label: t.label, value: t.value }))}
            />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.actionType !== cur.actionType}
          >
            {({ getFieldValue }) => (
              <Form.Item name='actionValue' noStyle>
                <Input
                  placeholder={getFieldValue('actionType') === 'notify' ? e('notifyOnly') : 'space, y, \\r, \\x03, ^M'}
                  style={{ flex: 1 }}
                  disabled={getFieldValue('actionType') === 'notify'}
                />
              </Form.Item>
            )}
          </Form.Item>
        </div>
      </Form.Item>
      <div style={{ display: 'flex', gap: 24 }}>
        <Form.Item
          noStyle
          shouldUpdate={(prev, cur) => prev.actionType !== cur.actionType}
        >
          {({ getFieldValue }) => (
            <Form.Item
              name='sendEnter'
              label={e('triggerSendEnter')}
              valuePropName='checked'
            >
              <Switch size='small' disabled={getFieldValue('actionType') === 'notify'} />
            </Form.Item>
          )}
        </Form.Item>
        <Form.Item
          name='mode'
          label={e('triggerMode')}
        >
          <Select
            style={{ width: 190 }}
            options={triggerModes.map(t => ({ label: t.label, value: t.value }))}
          />
        </Form.Item>
        <Form.Item
          noStyle
          shouldUpdate={(prev, cur) => prev.mode !== cur.mode}
        >
          {({ getFieldValue }) => (
            <Form.Item
              name='cooldownMs'
              label={e('triggerCooldown')}
            >
              <InputNumber
                min={0}
                max={600000}
                step={100}
                disabled={getFieldValue('mode') !== 'cooldown'}
              />
            </Form.Item>
          )}
        </Form.Item>
      </div>
    </Form>
  )
}
