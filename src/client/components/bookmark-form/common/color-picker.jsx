import React, { useState } from 'react'
import { Popover, ColorPicker as AntColorPicker } from 'antd'
import { defaultColors, getRandomHexColor } from '../../../common/rand-hex-color.js'
import { HexInput } from './hex-input.jsx'
import './color-picker.styl'

export const ColorPicker = React.forwardRef((props, ref) => {
  const { value, onChange } = props
  const [visible, setVisible] = useState(false)

  const handleChange = (color) => {
    onChange(color)
    setVisible(false)
  }

  const handleVisibleChange = (vis) => {
    setVisible(vis)
  }

  function onColorChange (color) {
    handleChange(props.isRgba ? color.toRgbString() : color.toHexString())
  }

  function renderContent () {
    return (
      <div className='color-picker-box'>
        <div className='fix'>
          <div className='fleft color-picker-defaults'>
            {
              [...defaultColors, 'random'].map((color) => {
                const style = color === 'random' ? { color: '#000' } : { color }
                const p = {
                  className: 'color-picker-unit',
                  style,
                  onClick: () => {
                    if (color === 'random') return handleChange(getRandomHexColor())
                    handleChange(color)
                  }
                }
                return <div {...p} key={color}>● {color}</div>
              })
            }
          </div>
          <div className='fright'>
            <AntColorPicker
              value={value}
              onChange={onColorChange}
            />
          </div>
        </div>
        <div className='pd1y'>
          <HexInput value={value} onChange={handleChange} />
        </div>
      </div>
    )
  }

  const inner = (
    <div ref={ref} className='color-picker-choose' style={{ backgroundColor: value }} />
  )

  if (props.disabled) return inner

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
})
