import React, { Component } from 'react'
import {
  CodeOutlined,
  LoadingOutlined
} from '@ant-design/icons'
import {
  message,
  Select,
  Switch,
  Input,
  Upload,
  InputNumber,
  Button,
  AutoComplete,
  Tooltip
} from 'antd'
import deepCopy from 'json-deep-copy'
import {
  noTerminalBgValue,
  rendererTypes,
  regexHelpLink
} from '../../common/constants'
import defaultSettings from '../../common/default-setting'
import ShowItem from '../common/show-item'
import { osResolve } from '../../common/resolve'
import { isNumber, isNaN } from 'lodash-es'
import mapper from '../../common/auto-complete-data-mapper'
import KeywordForm from './keywords-form'
import Link from '../common/external-link'
import HelpIcon from '../common/help-icon'
import './setting.styl'

const { Option } = Select
const { prefix } = window
const e = prefix('setting')
const s = prefix('ssh')
const p = prefix('sftp')
const t = prefix('terminalThemes')
const f = prefix('form')

export default class SettingTerminal extends Component {
  state = {
    ready: false
  }

  componentDidMount () {
    this.timer = setTimeout(() => {
      this.setState({
        ready: true
      })
    }, 200)
  }

  componentWillUnmount () {
    clearTimeout(this.timer)
  }

  handleResetAll = () => {
    this.saveConfig(
      deepCopy(defaultSettings)
    )
  }

  onChangeValue = (value, name) => {
    if (name === 'useSystemTitleBar') {
      message.info(e('useSystemTitleBarTip'), 5)
    }
    this.saveConfig({
      [name]: value
    })
  }

  handleChangeDelMode = v => this.onChangeValue(v, 'backspaceMode')
  handleChangeRenderType = v => this.onChangeValue(v, 'renderType')

  handleChangeFont = (values) => {
    this.onChangeValue(
      values.join(', '),
      'fontFamily'
    )
  }

  handleChangeCursorStyle = (cursorStyle) => {
    this.onChangeValue(
      cursorStyle,
      'cursorStyle'
    )
  }

  saveConfig = async (ext) => {
    const { config } = this.props
    if (ext.hotkey && ext.hotkey !== config.hotkey) {
      const res = await window.pre.runGlobalAsync('changeHotkey', ext.hotkey)
      if (!res) {
        message.warning(e('hotkeyNotOk'))
        delete ext.hotkey
      } else {
        message.success(e('saved'))
      }
    }
    this.props.store.setConfig(ext)
  }

  handleSubmitKeywords = (data) => {
    return this.saveConfig(data)
  }

  renderToggle = (name, extra = null) => {
    const checked = !!this.props.config[name]
    return (
      <div className='pd2b' key={'rt' + name}>
        <Switch
          checked={checked}
          checkedChildren={e(name)}
          unCheckedChildren={e(name)}
          onChange={v => this.onChangeValue(v, name)}
        />
        {isNumber(extra) ? null : extra}
      </div>
    )
  }

  renderNumber = (name, options, title = '', width = 136) => {
    let value = this.props.config[name]
    if (options.valueParser) {
      value = options.valueParser(value)
    }
    const defaultValue = defaultSettings[name]
    const {
      step = 1,
      min,
      max,
      cls,
      onChange = (v) => {
        this.onChangeValue(v, name)
      }
    } = options
    const opts = {
      step,
      value,
      min,
      max,
      onChange,
      placeholder: defaultValue
    }
    if (title) {
      opts.formatter = v => `${title}${options.extraDesc || ''}: ${v}`
      opts.parser = (v) => {
        let vv = isNumber(v)
          ? v
          : Number(v.split(': ')[1], 10)
        if (isNaN(vv)) {
          vv = defaultValue
        }
        return vv
      }
      opts.style = {
        width: width + 'px'
      }
    }
    return (
      <div className={`pd2b ${cls || ''}`}>
        <InputNumber
          {...opts}
        />
      </div>
    )
  }

  renderText = (name, placeholder) => {
    const value = this.props.config[name]
    const defaultValue = defaultSettings[name]
    const onChange = (e) => this.onChangeValue(e.target.value, name)
    return (
      <div className='pd2b'>
        <Input
          value={value}
          onChange={onChange}
          placeholder={placeholder || defaultValue}
        />
      </div>
    )
  }

  renderBgOption = item => {
    return {
      value: item.value,
      label: item.desc
    }
  }

  renderTerminalBgSelect = (name) => {
    const value = this.props.config[name]
    const defaultValue = defaultSettings[name]
    const onChange = (v) => this.onChangeValue(v, name)
    const after = (
      <Upload
        beforeUpload={(file) => {
          this.onChangeValue(file.path, name)
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
        desc: t('default')
      },
      {
        value: noTerminalBgValue,
        desc: e('noTerminalBg')
      }
    ]
    const numberOpts = { step: 0.05, min: 0, max: 1, cls: 'bg-img-setting' }

    const renderFilter = () => {
      if (this.props.config[name] === noTerminalBgValue) return

      return (
        <div>
          {
            this.renderNumber(
              'terminalBackgroundFilterOpacity',
              numberOpts,
              e('Opacity')
            )
          }
          {
            this.renderNumber(
              'terminalBackgroundFilterBlur',
              { ...numberOpts, min: 0, max: 50, step: 0.5 },
              e('Blur')
            )
          }
          {
            this.renderNumber(
              'terminalBackgroundFilterBrightness',
              { ...numberOpts, min: 0, max: 10, step: 0.1 },
              e('Brightness')
            )
          }
          {
            this.renderNumber(
              'terminalBackgroundFilterGrayscale',
              numberOpts,
              e('Grayscale')
            )
          }
          {
            this.renderNumber(
              'terminalBackgroundFilterContrast',
              { ...numberOpts, min: 0, max: 10, step: 0.1 },
              e('Contrast')
            )
          }
        </div>
      )
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
              options={dataSource.map(this.renderBgOption)}
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

  renderReset = () => {
    return (
      <div className='pd1b pd1t'>
        <Button
          onClick={this.handleResetAll}
        >
          {e('resetAllToDefault')}
        </Button>
      </div>
    )
  }

  renderDefaultTerminalType = () => {
    const opts = this.props.config.terminalTypes.map(mapper)
    return (
      <AutoComplete
        options={opts}
        style={{
          width: '200px'
        }}
        value={this.props.config.terminalType}
        onChange={(v) => this.onChangeValue(v, 'terminalType')}
      />
    )
  }

  renderCursorStyleSelect = () => {
    const {
      cursorStyle = 'block'
    } = this.props.config
    const sets = [
      {
        id: 'block',
        title: '▊'
      },
      {
        id: 'underline',
        title: '_'
      },
      {
        id: 'bar',
        title: '|'
      }
    ]
    const props = {
      onChange: this.handleChangeCursorStyle,
      value: cursorStyle,
      style: {
        width: '100px'
      }
    }
    return (
      <div className='pd1b'>
        <span className='inline-title mg1r'>{e('cursorStyle')}</span>
        <Select
          {...props}
          showSearch
        >
          {
            sets.map(f => {
              return (
                <Option value={f.id} key={f.id}>
                  <b>{f.title}</b>
                </Option>
              )
            })
          }
        </Select>
      </div>
    )
  }

  renderFontFamily = () => {
    const { fonts } = this.props.store
    const { fontFamily } = this.props.config
    const props = {
      mode: 'multiple',
      className: 'font-sel',
      onChange: this.handleChangeFont,
      value: fontFamily.split(/, */g).filter(d => d.trim())
    }
    return (
      <Select
        {...props}
        showSearch
      >
        {
          fonts.map(f => {
            return (
              <Option value={f} key={f}>
                <span
                  className='font-option'
                  style={{
                    fontFamily: f
                  }}
                >
                  {f}
                </span>
              </Option>
            )
          })
        }
      </Select>
    )
  }

  render () {
    const { ready } = this.state
    if (!ready) {
      return (
        <div className='pd3 aligncenter'>
          <LoadingOutlined />
        </div>
      )
    }
    const {
      rendererType,
      backspaceMode = '^?',
      keywords = [{ color: 'red' }]
    } = this.props.config
    const {
      appPath
    } = this.props.store
    const ps = {
      formData: {
        keywords
      },
      submit: this.handleSubmitKeywords
    }
    const terminalLogPath = appPath
      ? osResolve(appPath, 'electerm', 'session_logs')
      : window.et.sessionLogPath
    const tip = (
      <div>
        <span className='mg1r'>{f('supportRegexp')}</span>
        <Link to={regexHelpLink}>wiki</Link>
      </div>
    )
    return (
      <div className='form-wrap pd1y pd2x'>
        <div className='pd1y font16 bold'>
          <CodeOutlined className='mg1r' />
          {s('terminal')} {e('settings')}
        </div>
        {
          this.renderNumber('scrollback', {
            step: 200,
            min: 1000
          }, e('scrollBackDesc'), 400)
        }
        <div className='pd2b'>
          <span className='inline-title mg1r'>{e('rendererType')}</span>
          <Select
            onChange={this.handleChangeRenderType}
            value={rendererType}
            popupMatchSelectWidth={false}
          >
            {
              Object.keys(rendererTypes).map(id => {
                return (
                  <Option key={id} value={id}>{id}</Option>
                )
              })
            }
          </Select>
        </div>
        {
          this.renderNumber('fontSize', {
            step: 1,
            min: 9
          }, `${t('default')} ${e('fontSize')}`, 400)
        }
        <div className='pd2b'>
          <span className='inline-title mg1r'>{t('default')} {e('fontFamily')}</span>
          {
            this.renderFontFamily()
          }
        </div>
        <div className='pd2b'>
          <div className='pd1b'>
            <span className='inline-title mg1r'>{f('keywordsHighlight')}</span>
            <HelpIcon
              title={tip}
            />
          </div>
          <KeywordForm
            {...ps}
          />
        </div>
        <div className='pd2b'>
          <span className='inline-title mg1r'>{e('defaultTerminalType')}</span>
          {
            this.renderDefaultTerminalType()
          }
        </div>
        <div className='pd1b'>{e('terminalBackgroundImage')}</div>
        {
          this.renderTerminalBgSelect('terminalBackgroundImagePath')
        }
        <div className='pd1b'>{e('terminalWordSeparator')}</div>
        {
          this.renderText('terminalWordSeparator', e('terminalWordSeparator'))
        }
        {
          this.renderCursorStyleSelect()
        }
        {this.renderToggle('saveTerminalLogToFile', (
          <ShowItem to={terminalLogPath} className='mg1l'>{p('open')}</ShowItem>
        ))}
        {
          [
            'cursorBlink',
            'rightClickSelectsWord',
            'pasteWhenContextMenu',
            'copyWhenSelect',
            'ctrlOrMetaOpenTerminalLink'
          ].map(this.renderToggle)
        }
        <div className='pd1b'>{e('terminalBackSpaceMode')}</div>
        <Select
          onChange={this.handleChangeDelMode}
          value={backspaceMode}
          popupMatchSelectWidth={false}
        >
          {
            ['^?', '^H'].map(id => {
              return (
                <Option key={id} value={id}>{id}</Option>
              )
            })
          }
        </Select>
        {this.renderReset()}
      </div>
    )
  }
}
