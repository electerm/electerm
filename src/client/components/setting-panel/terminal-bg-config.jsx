import React, { useState } from 'react'
import {
  AutoComplete,
  Upload,
  Tooltip,
  Input
} from 'antd'
import {
  noTerminalBgValue,
  textTerminalBgValue
} from '../../common/constants'
import defaultSettings from '../../common/default-setting'
import NumberConfig from './number-config'
import TextBgModal from './text-bg-modal.jsx'
import { getFilePath } from '../../common/file-drop-utils'

const e = window.translate

export default function TerminalBackgroundConfig ({
  onChangeValue,
  name,
  config,
  isGlobal = false,
  batchUpdate
}) {
  const [showTextModal, setShowTextModal] = useState(false)
  const value = config[name]
  const defaultValue = defaultSettings[name]
  const onChange = (v) => onChangeValue(v, name)
  const after = (
    <Upload
      beforeUpload={(file) => {
        const filePath = getFilePath(file)
        onChangeValue(filePath, name)
        return false
      }}
      showUploadList={false}
    >
      <span>{e('chooseFile')}</span>
    </Upload>
  )

  const dataSource = [
    {
      value: '',
      desc: e('default')
    },
    {
      value: noTerminalBgValue,
      desc: e('noTerminalBg')
    },
    {
      value: textTerminalBgValue,
      desc: `📝 ${e('textBackground')}`
    }
  ]

  // Add custom text background option if text is configured
  if (value === textTerminalBgValue && config.terminalBackgroundText) {
    const text = config.terminalBackgroundText
    // Clean up the text for display: remove line breaks, trim whitespace
    const cleanText = text.replace(/\s+/g, ' ').trim()
    // Create a more user-friendly truncation
    const truncatedText = cleanText.length > 25
      ? cleanText.substring(0, 25) + '...'
      : cleanText
    dataSource[2] = {
      value: textTerminalBgValue,
      desc: `📝 "${truncatedText}"`
    }
  } else if (value === textTerminalBgValue) {
    // Show helpful text when text background is selected but no text is configured
    dataSource[2] = {
      value: textTerminalBgValue,
      desc: '📝 Click to configure text'
    }
  }

  if (isGlobal) {
    dataSource.push(
      {
        value: 'index',
        desc: e('index')
      },
      {
        value: 'randomShape',
        desc: `🎨 ${e('randomShape')}`
      }
    )
  }

  const handleTextBgClick = () => {
    setShowTextModal(true)
  }

  const handleTextBgModalOk = (textConfig) => {
    if (batchUpdate) {
      // Use batch update if available
      const updates = {
        terminalBackgroundText: textConfig.text,
        terminalBackgroundTextSize: textConfig.fontSize,
        terminalBackgroundTextColor: textConfig.color,
        terminalBackgroundTextFontFamily: textConfig.fontFamily,
        [name]: textTerminalBgValue
      }
      batchUpdate(updates)
    } else {
      // Fall back to sequential updates
      onChangeValue(textConfig.text, 'terminalBackgroundText')
      onChangeValue(textConfig.fontSize, 'terminalBackgroundTextSize')
      onChangeValue(textConfig.color, 'terminalBackgroundTextColor')
      onChangeValue(textConfig.fontFamily, 'terminalBackgroundTextFontFamily')
      onChange(textTerminalBgValue)
    }
    setShowTextModal(false)
  }

  const handleTextBgModalCancel = () => {
    setShowTextModal(false)
  }

  const handleAutocompleteSelect = (v) => {
    if (v === textTerminalBgValue) {
      handleTextBgClick()
    } else {
      onChange(v)
    }
  }

  const handleAutocompleteChange = (v) => {
    if (v === textTerminalBgValue) {
      handleTextBgClick()
    } else {
      onChange(v)
    }
  }

  const numberOpts = { step: 0.05, min: 0, max: 1, cls: 'bg-img-setting' }

  function renderNumber (name, options, title = '', width = 136) {
    let value = config[name]
    if (options.valueParser) {
      value = options.valueParser(value)
    }
    const defaultValue = defaultSettings[name]
    const {
      step = 1,
      min,
      max,
      cls
    } = options
    const opts = {
      value,
      min,
      max,
      onChange: (v) => {
        onChangeValue(v, name)
      },
      defaultValue,
      title,
      width,
      step,
      cls
    }
    return (
      <NumberConfig {...opts} />
    )
  }

  const renderFilter = () => {
    if (config[name] === noTerminalBgValue || config[name] === 'index' || config[name] === textTerminalBgValue) return

    return (
      <div>
        {
          renderNumber(
            'terminalBackgroundFilterOpacity',
            numberOpts,
            e('Opacity')
          )
        }
        {
          renderNumber(
            'terminalBackgroundFilterBlur',
            { ...numberOpts, min: 0, max: 50, step: 0.5 },
            e('Blur')
          )
        }
        {
          renderNumber(
            'terminalBackgroundFilterBrightness',
            { ...numberOpts, min: 0, max: 10, step: 0.1 },
            e('Brightness')
          )
        }
        {
          renderNumber(
            'terminalBackgroundFilterGrayscale',
            numberOpts,
            e('Grayscale')
          )
        }
        {
          renderNumber(
            'terminalBackgroundFilterContrast',
            { ...numberOpts, min: 0, max: 10, step: 0.1 },
            e('Contrast')
          )
        }
      </div>
    )
  }

  const renderBgOption = item => {
    return {
      value: item.value,
      label: item.desc
    }
  }
  return (
    <div className='pd2b'>
      <div className='pd1b'>
        <Tooltip
          title='eg: https://xx.com/xx.png or /path/to/xx.png'
        >
          <AutoComplete
            value={value}
            onChange={handleAutocompleteChange}
            onSelect={handleAutocompleteSelect}
            placeholder={defaultValue}
            className='width-100'
            options={dataSource.map(renderBgOption)}
          >
            <Input
              addonAfter={after}
            />
          </AutoComplete>
        </Tooltip>
      </div>

      {
        renderFilter()
      }

      <TextBgModal
        visible={showTextModal}
        onOk={handleTextBgModalOk}
        onCancel={handleTextBgModalCancel}
        initialText={config.terminalBackgroundText || ''}
        initialSize={config.terminalBackgroundTextSize || 48}
        initialColor={config.terminalBackgroundTextColor || '#ffffff'}
        initialFontFamily={config.terminalBackgroundTextFontFamily || 'monospace'}
      />
    </div>
  )
}
