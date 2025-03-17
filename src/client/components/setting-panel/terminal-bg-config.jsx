import React from 'react'
import {
  AutoComplete,
  Upload,
  Tooltip,
  Input
} from 'antd'
import {
  noTerminalBgValue
} from '../../common/constants'
import defaultSettings from '../../common/default-setting'
import NumberConfig from './number-config'

const e = window.translate

export default function TerminalBackgroundConfig ({
  onChangeValue,
  name,
  config
}) {
  const value = config[name]
  const defaultValue = defaultSettings[name]
  const onChange = (v) => onChangeValue(v, name)
  const after = (
    <Upload
      beforeUpload={(file) => {
        onChangeValue(file.path, name)
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
    }
  ]
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
    if (config[name] === noTerminalBgValue) return

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
            onChange={onChange}
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
    </div>
  )
}
