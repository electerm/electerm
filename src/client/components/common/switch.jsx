/**
 * antd Switch wrapper.
 *
 * `checkedChildren` / `unCheckedChildren` cram the label text inside the
 * toggle, which renders poorly on small / touch screens. This wrapper drops
 * those props and renders an optional text label as a sibling `<span>`
 * instead. Clicking the label toggles the switch by default.
 *
 * Passes every other prop (checked, onChange, size, disabled, ref, ...) through
 * to the underlying antd Switch, so it is a drop-in replacement and is safe
 * inside antd Form.Item (`valuePropName='checked'`).
 */

import { memo } from 'react'
import { Switch } from 'antd'
import './switch.styl'

function SwitchLabel (props) {
  const {
    label,
    labelPosition = 'after',
    labelClickToggle = true,
    className = '',
    labelClassName = '',
    checked,
    onChange,
    ref,
    ...rest
  } = props
  const hasLabel = label !== undefined && label !== null && label !== ''
  const onLabelClick = labelClickToggle && onChange
    ? () => onChange(!checked)
    : undefined
  const labelEl = hasLabel
    ? (
      <span
        className={
          'switch-label-text' +
          (labelPosition === 'before' ? ' mg1r' : ' mg1l') +
          (labelClickToggle ? ' pointer' : '') +
          (labelClassName ? ' ' + labelClassName : '')
        }
        onClick={onLabelClick}
      >
        {label}
      </span>
      )
    : null
  return (
    <span className={'switch-label-wrap' + (className ? ' ' + className : '')}>
      {labelPosition === 'before' ? labelEl : null}
      <Switch
        checked={checked}
        onChange={onChange}
        ref={ref}
        {...rest}
      />
      {labelPosition === 'after' ? labelEl : null}
    </span>
  )
}

export default memo(SwitchLabel)
