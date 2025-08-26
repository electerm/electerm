import React, { useState } from 'react'
import {
  Modal,
  Input,
  InputNumber,
  Space,
  Typography,
  Select
} from 'antd'
import { ColorPicker } from '../bookmark-form/common/color-picker.jsx'

const { TextArea } = Input
const { Title } = Typography
const e = window.translate

export default function TextBgModal ({
  visible,
  onOk,
  onCancel,
  initialText = '',
  initialSize = 48,
  initialColor = '#ffffff',
  initialFontFamily = 'Maple Mono'
}) {
  const [text, setText] = useState(initialText)
  const [fontSize, setFontSize] = useState(initialSize)
  const [color, setColor] = useState(initialColor)
  const [fontFamily, setFontFamily] = useState(initialFontFamily)

  const { fonts = [] } = window.et || {}

  const handleOk = () => {
    onOk({
      text,
      fontSize,
      color,
      fontFamily
    })
  }

  const handleCancel = () => {
    onCancel()
    // Reset to initial values
    setText(initialText)
    setFontSize(initialSize)
    setColor(initialColor)
    setFontFamily(initialFontFamily)
  }

  return (
    <Modal
      title={e('terminalBackgroundText')}
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      width={500}
      destroyOnHidden
    >
      <div className='pd1'>
        <Space direction='vertical' size='large' style={{ width: '100%' }}>
          <div>
            <Title level={5}>{e('text')}</Title>
            <TextArea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={e('enterTextForBackground')}
              rows={4}
              maxLength={500}
            />
          </div>

          <div>
            <Title level={5}>{e('fontSize')}</Title>
            <InputNumber
              value={fontSize}
              onChange={setFontSize}
              min={12}
              max={200}
              style={{ width: '100%' }}
              placeholder={e('fontSize')}
            />
          </div>

          <div>
            <Title level={5}>{e('textColor')}</Title>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ColorPicker
                value={color}
                onChange={setColor}
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder={e('colorValue')}
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <div>
            <Title level={5}>{e('fontFamily')}</Title>
            <Select
              value={fontFamily}
              onChange={setFontFamily}
              style={{ width: '100%' }}
              placeholder={e('selectFontFamily')}
              showSearch
            >
              {
                fonts.map(f => {
                  return (
                    <Select.Option value={f} key={f}>
                      <span
                        className='font-option'
                        style={{
                          fontFamily: f
                        }}
                      >
                        {f}
                      </span>
                    </Select.Option>
                  )
                })
              }
            </Select>
          </div>
        </Space>
      </div>
    </Modal>
  )
}
