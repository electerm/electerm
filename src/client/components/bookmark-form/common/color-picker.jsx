import React, { useState } from 'react'
import { Popover, ColorPicker as AntColorPicker, Tooltip } from 'antd'
import { CheckOutlined } from '@ant-design/icons'
import classnames from 'classnames'
import { defaultColors, getRandomHexColor } from '../../../common/rand-hex-color.js'
import { HexInput } from './hex-input.jsx'
import './color-picker.styl'

export function ColorPicker ({ value, onChange, ref, disabled, isRgba, onLockedClick }) {
  const [visible, setVisible] = useState(false)

  const handleChange = (color) => {
    onChange(color)
    setVisible(false)
  }

  const handleVisibleChange = (vis) => {
    setVisible(vis)
  }

  function onColorChange (color) {
    handleChange(isRgba ? color.toRgbString() : color.toHexString())
  }

  const isSelected = (color) => (value || '').toLowerCase() === color.toLowerCase()

  function renderContent () {
    return (
      <div className='color-picker-box'>
        <div className='color-picker-swatches'>
          {
            defaultColors.map((color) => (
              <Tooltip title={color} key={color}>
                <button
                  type='button'
                  className={classnames('color-picker-swatch', { 'is-selected': isSelected(color) })}
                  style={{ backgroundColor: color }}
                  onClick={() => handleChange(color)}
                >
                  {isSelected(color) ? <CheckOutlined /> : null}
                </button>
              </Tooltip>
            )
            )
          }
          <Tooltip title='Random color'>
            <button
              type='button'
              className='color-picker-swatch color-picker-swatch-random'
              onClick={() => handleChange(getRandomHexColor())}
            >
              🎲
            </button>
          </Tooltip>
        </div>
        <div className='color-picker-advanced'>
          <Tooltip title='Custom color'>
            <AntColorPicker
              value={value}
              onChange={onColorChange}
            />
          </Tooltip>
          <HexInput value={value} onChange={handleChange} />
        </div>
      </div>
    )
  }

  const inner = (
    <div ref={ref} className='color-picker-choose' style={{ backgroundColor: value }} />
  )

  if (disabled && onLockedClick) {
    return (
      <Tooltip title='Click to customize'>
        <div
          ref={ref}
          className='color-picker-choose color-picker-choose-locked'
          style={{ backgroundColor: value }}
          onClick={onLockedClick}
        />
      </Tooltip>
    )
  }

  if (disabled) return inner

  return (
    <Popover
      content={renderContent()}
      trigger='click'
      open={visible}
      placement='bottomLeft'
      onOpenChange={handleVisibleChange}
    >
      {inner}
    </Popover>
  )
}
