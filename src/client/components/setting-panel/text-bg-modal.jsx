import React, { useState } from 'react'
import {
  Input,
  InputNumber,
  Space,
  Select,
  Button,
  Modal
} from 'antd'
import { ColorPicker } from '../bookmark-form/common/color-picker.jsx'

const { TextArea } = Input
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

  const footer = (
    <>
      <Button onClick={handleCancel}>
        {e('cancel')}
      </Button>
      <Button type='primary' onClick={handleOk} className='mg1l'>
        {e('ok')}
      </Button>
    </>
  )

  return (
    <Modal
      title={e('terminalBackgroundText')}
      open={visible}
      onCancel={handleCancel}
      width={500}
      footer={footer}
    >
      <div className='pd1'>
        <Space orientation='vertical' size='large' className='width-100'>
          <div>
            <b>{e('text')}</b>
            <TextArea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={e('enterTextForBackground')}
              rows={4}
              maxLength={500}
            />
          </div>

          <div>
            <b>{e('fontSize')}</b>
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
            <b>{e('textColor')}</b>
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
            <b>{e('fontFamily')}</b>
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

TextBgModal.displayName = 'TextBgModal'
