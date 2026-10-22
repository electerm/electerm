/**
 * One config entry -> one antd Form.Item.
 *
 * Shared by the built-in widget run form (widget-form.jsx) and the generated
 * form of a config-mode user widget (custom-widget-form.jsx), so a field type
 * means the same thing in both places.
 *
 * Config entry shape (user widgets, see app/widgets/user-widget.js):
 *   { name, label, type, description, placeholder, required, default,
 *     choices: [{ label, value }], filters }
 * Built-in widgets use `name` as their label and pass plain strings as choices;
 * both forms are accepted here.
 */
import React from 'react'
import { Form, Input, InputNumber, Select, Button, Space } from 'antd'
import { formItemLayout } from '../../common/form-layout'
import SwitchLabel from '../common/switch'
import { nanoid } from 'nanoid'

const e = window.translate

export const CONFIG_FIELD_TYPES = [
  'string',
  'textarea',
  'number',
  'boolean',
  'password',
  'file',
  'directory',
  'select'
]

function labelOf (config) {
  return config.label || config.name
}

function placeholderOf (config) {
  return config.placeholder || config.description || ''
}

function choicesOf (config) {
  return (config.choices || []).map(choice => (
    choice && typeof choice === 'object'
      ? choice
      : { label: String(choice), value: choice }
  ))
}

export function configInitialValues (configs) {
  return (configs || []).reduce((acc, config) => {
    acc[config.name] = config.default
    return acc
  }, {})
}

export function renderConfigItem (config, form) {
  const {
    name,
    type,
    description
  } = config
  const label = labelOf(config)
  const placeholder = placeholderOf(config)
  const choices = choicesOf(config)
  const hasChoices = choices.length > 0
  const requiredRules = config.required
    ? [{ required: true, message: `${label} is required` }]
    : undefined

  const wrap = (control, options = {}) => (
    <Form.Item
      key={name}
      {...formItemLayout}
      label={label}
      name={options.noOuterName ? undefined : name}
      tooltip={description}
      rules={requiredRules}
    >
      {control}
    </Form.Item>
  )

  const choiceSelect = (
    <Select placeholder={placeholder}>
      {choices.map(choice => (
        <Select.Option key={choice.value} value={choice.value}>
          {choice.label}
        </Select.Option>
      ))}
    </Select>
  )

  switch (type) {
    case 'boolean':
      return (
        <Form.Item
          key={name}
          {...formItemLayout}
          label={label}
          name={name}
          valuePropName='checked'
          tooltip={description}
        >
          <SwitchLabel />
        </Form.Item>
      )
    case 'textarea':
      return wrap(<Input.TextArea autoSize={{ minRows: 3 }} placeholder={placeholder} />)
    case 'number':
      return wrap(<InputNumber style={{ width: '100%' }} placeholder={placeholder} />)
    case 'password':
      return wrap(<Input.Password placeholder={placeholder} autoComplete='off' />)
    case 'select':
      return wrap(choiceSelect)
    case 'file':
    case 'directory':
      return wrap(
        <Space.Compact style={{ width: '100%' }}>
          <Form.Item noStyle name={name} rules={requiredRules}>
            <Input
              readOnly
              placeholder={placeholder || e(type === 'directory' ? 'folder' : 'selectFilePath')}
            />
          </Form.Item>
          <Button
            onClick={async () => {
              // plain copy on purpose: the config object comes from the store,
              // and a proxied value makes ipcRenderer.invoke fail to clone it
              const opts = {
                title: String(label),
                properties: [type === 'directory' ? 'openDirectory' : 'openFile']
              }
              if (type !== 'directory' && Array.isArray(config.filters) && config.filters.length) {
                opts.filters = config.filters.map(filter => ({
                  name: String(filter.name),
                  extensions: filter.extensions.map(String)
                }))
              }
              const files = await window.api.openDialog(opts)
              if (files && files[0]) {
                form.setFieldValue(name, files[0])
              }
            }}
          >
            {e(type === 'directory' ? 'chooseFolder' : 'selectFilePath')}
          </Button>
        </Space.Compact>,
        { noOuterName: true }
      )
    case 'string':
    default: {
      const input = <Input placeholder={placeholder} />
      if (config.showGenerator) {
        return wrap(
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item noStyle name={name}>
              {input}
            </Form.Item>
            <Button onClick={() => form.setFieldValue(name, 'ett_' + nanoid())}>
              Generate
            </Button>
          </Space.Compact>,
          { noOuterName: true }
        )
      }
      return wrap(hasChoices ? choiceSelect : input)
    }
  }
}
