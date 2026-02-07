import React from 'react'
import InputNumberConfirm from './input-number-confirm'
import {
  Space
} from 'antd'
import {
  MinusCircleOutlined,
  PlusCircleOutlined
} from '@ant-design/icons'

export default function ZoomControl (props) {
  const {
    value,
    onChange,
    min = 0.25,
    max = 5,
    step = 0.25
  } = props

  const handleChange = (v) => {
    onChange(v / 100)
  }

  const handleAdd = () => {
    let next = value + step
    if (next > max) next = max
    onChange(next)
  }

  const handleMinus = () => {
    let next = value - step
    if (next < min) next = min
    onChange(next)
  }

  return (
    <InputNumberConfirm
      value={Math.round(value * 100)}
      onChange={handleChange}
      step={1}
      min={min * 100}
      max={max * 100}
      suffix='%'
      addonBefore={
        <Space.Compact>
          <PlusCircleOutlined
            onClick={handleAdd}
            className='mg1r pointer font16'
          />
          <MinusCircleOutlined
            onClick={handleMinus}
            className='pointer font16 mg1r'
          />
        </Space.Compact>
      }
    />
  )
}
