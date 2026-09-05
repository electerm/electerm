/**
 * Single trigger rule form (used inside a Modal by TriggerEditor).
 * Controlled via antd Form, initialValues = editing rule.
 */
import { useEffect } from 'react'
import {
  Form,
  Input,
  Switch,
  Select,
  InputNumber,
  Radio
} from 'antd'
import {
  triggerActionTypes,
  triggerMatchTypes,
  triggerModes
} from '../terminal/automation/trigger-presets.js'
import { te as e } from './trigger-lang.js'

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

  return (
    <Form
      form={form}
      layout='vertical'
      preserve={false}
    >
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
