/**
 * input with auto focus
 */

import React from 'react'
import './native-input.styl'

export default function InputNative (props) {
  const { value, type, onChange, onPressEnter, addonAfter = null, ...rest } = props
  return (
    <span
      className='ant-input-group-wrapper'
      data-id={props['data-id']}
    >
      <span className='ant-input-wrapper ant-input-group'>
        <input
          class='ant-input native-input'
          type='text'
          value={value}
          onChange={onChange}
          onPressEnter={onPressEnter}
          {...rest}
        />
      </span>
      <span class='ant-input-group-addon'>
        {addonAfter}
      </span>
    </span>
  )
}
