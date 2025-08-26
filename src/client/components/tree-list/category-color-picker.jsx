import React from 'react'
import { ColorPicker } from '../bookmark-form/common/color-picker.jsx'

export function CategoryColorPicker ({ value, onChange }) {
  return (
    <ColorPicker
      value={value}
      onChange={onChange}
    />
  )
}
