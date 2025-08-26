/**
 * bookmark form
 */
import React from 'react'
import { Form } from 'antd'
import TerminalBackgroundConfig from '../../setting-panel/terminal-bg-config'
import { formItemLayout } from '../../../common/form-layout'

const FormItem = Form.Item

const e = window.translate

// Custom form control that implements the antd form control interface
const TerminalBgControl = ({ value = {}, onChange }) => {
  const handleChange = (newValue, name) => {
    const updatedValue = {
      ...value,
      [name]: newValue
    }
    onChange(updatedValue)
  }

  return (
    <TerminalBackgroundConfig
      config={value}
      onChangeValue={handleChange}
      name='terminalBackgroundImagePath'
    />
  )
}

export default function renderTermBg (form) {
  const formProps = {
    ...formItemLayout,
    name: 'terminalBackground',
    label: e('terminalBackgroundImage')
  }
  return (
    <FormItem {...formProps}>
      <TerminalBgControl />
    </FormItem>
  )
}
