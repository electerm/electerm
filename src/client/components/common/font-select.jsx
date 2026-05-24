import React, { useMemo, useCallback } from 'react'
import { Select } from 'antd'

const e = window.translate

export default function FontSelect ({
  value,
  onChange,
  placeholder,
  style
}) {
  const { fonts = [] } = window.et || {}

  const options = useMemo(() => {
    return fonts.map(f => ({
      value: f,
      label: (
        <span
          className='iblock'
          style={{ fontFamily: f }}
        >
          {f}
        </span>
      )
    }))
  }, [fonts])

  const handleChange = useCallback((vals) => {
    onChange(vals)
  }, [onChange])

  return (
    <Select
      mode='tags'
      value={value}
      onChange={handleChange}
      className='width-100'
      placeholder={placeholder || e('selectFontFamily')}
      showSearch
      options={options}
      filterOption={(input, option) =>
        (option?.value ?? '').toLowerCase().includes(input.toLowerCase())}
    />
  )
}
