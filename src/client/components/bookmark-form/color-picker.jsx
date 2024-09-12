import React, { useState } from 'react'
import { Popover } from 'antd'
import { HexColorPicker, RgbaColorPicker } from 'react-colorful'
import { defaultColors, getRandomHexColor } from '../../common/rand-hex-color.js'
import { HexInput } from './hex-input.jsx'
import './color-picker.styl'

// Your Custom Color Picker component
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

  function renderContent () {
    const Picker = props.isRgba ? RgbaColorPicker : HexColorPicker
    return (
      <div className='color-picker-box'>
        <div className='fix'>
          <div className='fleft color-picker-defaults'>
            {
              [...defaultColors, 'random'].map((color) => {
                const style = color === 'random'
                  ? {
                      color: '#000'
                    }
                  : {
                      color
                    }
                const props = {
                  className: 'color-picker-unit',
                  style,
                  onClick: () => {
                    if (color === 'random') {
                      return handleChange(getRandomHexColor())
                    }
                    handleChange(color)
                  }
                }
                return (
                  <div
                    {...props}
                    key={color}
                  >
                    ● {color}
                  </div>
                )
              })
            }
          </div>
          <div className='fright'>
            <Picker
              color={value}
              onChange={handleChange}
            />
          </div>
        </div>
        <div className='pd1y'>
          <HexInput
            value={value}
            onChange={handleChange}
          />
        </div>
      </div>
    )
  }

  const inner = (
    <div
      ref={ref}
      className='color-picker-choose'
      style={{
        backgroundColor: value
      }}
    />
  )

  if (props.disabled) {
    return inner
  }

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
