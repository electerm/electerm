/**
 * Field renderers for config-driven forms
 * Maps field types to React components
 */
import React from 'react'
import { Form, Input, InputNumber, Select, AutoComplete, Alert, Radio, Row, Col } from 'antd'
import { ColorPickerItem } from './color-picker-item.jsx'
import Password from '../../common/password.jsx'
import SwitchLabel from '../../common/switch.jsx'
import InputAutoFocus from '../../common/input-auto-focus.jsx'
import ProxyField from './proxy.jsx'
import X11Field from './x11.jsx'
import SshTunnels from './ssh-tunnels.jsx'
import SshAgent from './ssh-agent.jsx'
import ConnectionHopping from './connection-hopping.jsx'
import TerminalBackgroundField from './terminal-background.jsx'
import ExecSettingsField from './exec-settings-field.jsx'
import useQuickCmds from './quick-commands.jsx'
import ProfileItem from './profile-item.jsx'
import renderRunScripts from './run-scripts.jsx'
import SerialPathSelector from './serial-path-selector.jsx'
import SshHostSelector from './ssh-host-selector.jsx'
import SshAuthTypeSelector from './ssh-auth-type-selector.jsx'
import SshAuthSelector from './ssh-auth-selector.jsx'
import CategorySelect from './category-select.jsx'
import ExternalLink from '../../common/external-link.jsx'
const Fragment = React.Fragment
const FormItem = Form.Item

const { TextArea } = Input
const commonRenderTypes = new Set([
  'input',
  'textarea',
  'number',
  'switch',
  'select',
  'autocomplete',
  'radio',
  'colorTitle',
  'password'
])

/**
 * Render a single form item based on config
 * @param {Object} item - Field configuration with type, name, label, rules, etc.
 * @param {Object} formItemLayout - Ant Design form layout
 * @param {Object} form - Ant Design form instance
 * @param {Object} ctxProps - Context props (bookmarkGroups, formData, etc.)
 * @param {number} index - Index for key generation
 * @returns {JSX.Element|null} Rendered form item
 */
export function renderFormItem (item, formItemLayout, form, ctxProps, index) {
  const { type, name, label, rules, valuePropName, hidden, normalize } = item

  // Render simple AntD controls directly inside Form.Item
  if (commonRenderTypes.has(type)) {
    const cls = hidden ? 'hide' : undefined
    let control = null
    switch (type) {
      case 'input':
        control = <Input {...item.props} />
        break
      case 'textarea':
        control = <TextArea autoSize={{ minRows: 1 }} {...item.props} />
        break
      case 'number':
        control = <InputNumber min={1} max={65535} step={1} {...item.props} />
        break
      case 'switch':
        control = <SwitchLabel {...item.props} />
        break
      case 'select':
        control = <Select options={item.options} {...item.props} />
        break
      case 'autocomplete':
        control = <AutoComplete options={item.options} {...item.props} />
        break
      case 'radio':
        control = (
          <Radio.Group
            options={item.options}
            optionType='button'
            buttonStyle='solid'
            size='small'
            {...item.props}
          />
        )
        break
      case 'colorTitle':
        control = <InputAutoFocus prefix={<ColorPickerItem />} {...item.props} />
        break
      case 'password':
        control = <Password {...item.props} />
        break
      default:
        control = null
    }
    if (!control) return null
    const formItemProps = {
      ...formItemLayout,
      className: cls,
      label: typeof label === 'string' ? label : label(),
      name,
      rules,
      valuePropName,
      normalize
    }
    return (
      <FormItem
        key={name}
        {...formItemProps}
      >
        {control}
      </FormItem>
    )
  }

  // Render complex/custom components directly (no extra wrapper component)
  switch (type) {
    // Puts short fields side by side instead of each on its own line.
    // Purely presentational: every child is the same field it was before.
    case 'row':
      return (
        <div className='bookmark-form-row' key={name}>
          {
            label
              ? (
                <div className='bookmark-form-row-label'>
                  {typeof label === 'function' ? label() : label}
                </div>
                )
              : null
          }
          {/* align='bottom' so the controls line up even when one child
              carries an extra caption line above its input. */}
          <Row gutter={12} align='bottom'>
            {
              (item.children || []).map((child, i) => (
                <Col
                  key={child.name || i}
                  span={child.span || 12}
                  className={child.hideLabel ? 'hide-own-label' : undefined}
                >
                  {renderFormItem(child, formItemLayout, form, ctxProps, i)}
                </Col>
              ))
            }
          </Row>
        </div>
      )
    // A section is only a heading plus a hairline rule: it groups the fields
    // that follow it without collapsing, persisting state or changing any
    // field itself.
    case 'section':
      return (
        <div className='bookmark-form-section' key={name}>
          {typeof label === 'function' ? label() : label}
        </div>
      )
    case 'wiki':
      return (
        <Alert
          key={name}
          type='warning'
          className='mg2b'
          showIcon
          description={
            <>
              <ExternalLink to={item.link}>{item.link}</ExternalLink>
            </>
          }
        />
      )
    case 'alert':
      return <Alert key={name} {...item.props} />
    case 'info':
      return <Alert key={name} type='info' {...item.props} />
    case 'warning':
      return <Alert key={name} type='warning' {...item.props} />
    case 'categorySelect':
      return (
        <CategorySelect
          key={name}
          bookmarkGroups={ctxProps.bookmarkGroups || []}
          form={ctxProps.form}
          name={item.name}
          formData={ctxProps.formData}
        />
      )
    case 'proxy':
      return <ProxyField key={name} bookmarks={ctxProps.bookmarks} />
    case 'x11':
      return <X11Field key={name} form={form} />
    case 'sshTunnels':
      return <SshTunnels key={name} form={form} formData={ctxProps.formData} />
    case 'sshAgent':
      return <SshAgent key={name} />
    case 'connectionHopping':
      return (
        <ConnectionHopping
          key={name}
          form={form}
          formData={ctxProps.formData || {}}
          trim={ctxProps.trim}
          store={ctxProps.store}
        />
      )
    case 'terminalBackground':
      return <TerminalBackgroundField key={name} />
    case 'execSettings':
      return <ExecSettingsField key={name} />
    case 'profileItem':
      return <ProfileItem key={name} store={ctxProps.store} profileFilter={item.profileFilter} />
    case 'quickCommands':
      return <Fragment key={name}>{useQuickCmds(form, ctxProps.formData || {})}</Fragment>
    case 'runScripts':
      return <Fragment key={name}>{renderRunScripts()}</Fragment>
    case 'serialPathSelector':
      return (
        <SerialPathSelector
          key={name}
          serials={ctxProps.serials}
          loaddingSerials={ctxProps.loaddingSerials}
          store={ctxProps.store}
          {...item.props}
        />
      )
    case 'sshHostSelector':
      return (
        <SshHostSelector
          key={name}
          ips={ctxProps.ips || []}
          useIp={ctxProps.useIp}
          form={ctxProps.form}
          onBlur={ctxProps.handleBlur}
          onPaste={ctxProps.handlePaste}
          trim={ctxProps.trim}
          {...item.props}
        />
      )
    case 'sshAuthTypeSelector':
      return (
        <SshAuthTypeSelector
          key={name}
          authType={ctxProps.authType}
          handleChangeAuthType={ctxProps.onChangeAuthType}
          {...item.props}
        />
      )
    case 'sshAuthSelector':
      return (
        <SshAuthSelector
          key={name}
          store={ctxProps.store}
          form={form}
          authType={ctxProps.authType}
          profileFilter={item.profileFilter}
          {...item.props}
        />
      )
    default:
      console.warn(`Unknown field type: ${type}`)
      return null
  }
}
