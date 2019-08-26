
import { Component } from 'react'
import {
  message, Select, Switch,
  Input, Icon, Upload,
  InputNumber, Alert, Button
} from 'antd'
import deepCopy from 'json-deep-copy'

const InputGroup = Input.Group
const { Option } = Select
const { getGlobal, prefix } = window
const e = prefix('setting')
const f = prefix('form')
const s = prefix('ssh')
const t = prefix('terminalThemes')
const modifiers = [
  'Command',
  'Control',
  'Alt',
  'Shift'
]
const keys = [
  ...'0123456789~ABCDEFGHIJKLMNOPQRTSUVWXYZ'.split(''),
  ...new Array(12).fill(0).map((m, i) => {
    return 'F' + (i + 1)
  })
]

export default class Setting extends Component {
  state = {
    languageChanged: false
  }

  restart = () => {
    getGlobal('restart')()
  }

  resetAll = () => {
    this.saveConfig(
      deepCopy(this.props.config.defaultSettings)
    )
  }

  onChangeModifier = modifier => {
    const { hotkey } = this.props.config
    const key = hotkey.split('+')[1]
    return this.saveConfig({
      hotkey: `${modifier}+${key}`
    })
  }

  onChangeTimeout = sshReadyTimeout => {
    return this.saveConfig({
      sshReadyTimeout: sshReadyTimeout
    })
  }

  onChangeKey = key => {
    const { hotkey } = this.props.config
    const modifier = hotkey.split('+')[0]
    return this.saveConfig({
      hotkey: `${modifier}+${key}`
    })
  }

  onChangeLang = language => {
    this.setState({
      languageChanged: true
    })
    return this.saveConfig({
      language
    })
  }

  onChangeTerminalTheme = id => {
    this.props.store.setTheme(id)
  }

  onChangeValue = (value, name) => {
    this.saveConfig({
      [name]: value
    })
  }

  saveConfig = (_ext) => {
    const config = deepCopy(this.props.config)
    const ext = deepCopy(_ext)
    const update = {
      config: Object.assign({}, config, deepCopy(_ext))
    }
    const saveUserConfig = getGlobal('saveUserConfig')
    if (ext.hotkey && ext.hotkey !== config.hotkey) {
      const changeHotkey = getGlobal('changeHotkey')
      const res = changeHotkey(ext.hotkey)
      if (!res) {
        message.warn(e('hotkeyNotOk'))
        update.config.hotkey = config.hotkey
        ext.hotkey = config.hotkey
      } else {
        message.success(e('saved'))
      }
    }
    saveUserConfig && saveUserConfig(ext)
    this.props.store.modifier(update)
  }

  renderOption = (m, i) => {
    return (
      <Option value={m} key={m + 'opt' + i}>{m}</Option>
    )
  }

  renderToggle = (name) => {
    const checked = !!this.props.config[name]
    return (
      <div className='pd2b'>
        <Switch
          checked={checked}
          checkedChildren={e(name)}
          unCheckedChildren={e(name)}
          onChange={v => this.onChangeValue(v, name)}
        />
      </div>
    )
  }

  renderLanguageChangeTip = () => {
    if (!this.state.languageChanged) {
      return null
    }
    return (
      <div className='pd1t'>
        <Alert
          message={
            <div>
              {e('saveLang')}
              <Button
                onClick={this.restart}
                className='mg1l'
              >
                {e('restartNow')}
              </Button>
            </div>
          }
          type='success'
        />
      </div>
    )
  }

  renderNumber = (name, options) => {
    const value = this.props.config[name]
    const defaultValue = this.props.config.defaultSettings[name]
    const {
      step = 1,
      min,
      max,
      cls,
      onChange = (v) => this.onChangeValue(v, name)
    } = options
    const opts = {
      step,
      value,
      min,
      max,
      onChange,
      placeholder: defaultValue
    }
    return (
      <div className={`pd2b ${cls}`}>
        <InputNumber
          {...opts}
        />
      </div>
    )
  }

  renderText = (name) => {
    const value = this.props.config[name]
    const defaultValue = this.props.config.defaultSettings[name]
    const onChange = (e) => this.onChangeValue(e.target.value, name)
    return (
      <div className='pd2b'>
        <Input
          value={value}
          onChange={onChange}
          placeholder={defaultValue}
        />
      </div>
    )
  }

  renderTerminalBgSelect = (name) => {
    const value = this.props.config[name]
    const defaultValue = this.props.config.defaultSettings[name]
    const onChange = (e) => this.onChangeValue(e.target.value, name)
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
    return (
      <div className='pd2b'>
        <Input
          value={value}
          onChange={onChange}
          placeholder={defaultValue}
          addonAfter={after}
        />
      </div>
    )
  }

  renderReset = () => {
    return (
      <div className='pd1b pd1t'>
        <Button
          onClick={this.resetAll}
        >
          {e('resetAllToDefault')}
        </Button>
      </div>
    )
  }

  renderProxy () {
    const {
      enableGlobalProxy,
      proxyPort,
      proxyType,
      proxyIp
    } = this.props.config
    return (
      <div className='pd1b'>
        <div className='pd1b'>
          <span className='pd1r'>
            {e('global')} {f('proxy')}
          </span>
          <Switch
            checked={enableGlobalProxy}
            onChange={v => {
              this.onChangeValue(v, 'enableGlobalProxy')
            }}
          />
        </div>
        <div className='pd2b'>
          <InputGroup compact>
            <Select
              value={proxyType}
              disabled={!enableGlobalProxy}
              onChange={v => {
                this.onChangeValue(v, 'proxyType')
              }}
            >
              <Option value='5'>sock5</Option>
              <Option value='4'>sock4</Option>
              <Option value='0'>http</Option>
            </Select>
            <Input
              style={{ width: '65%' }}
              value={proxyIp}
              placeholder={f('proxyIp')}
              disabled={!enableGlobalProxy}
              onChange={e => {
                this.onChangeValue(
                  e.target.value, 'proxyIp'
                )
              }}
            />
            <InputNumber
              value={proxyPort}
              placeholder={f('proxyPort')}
              disabled={!enableGlobalProxy}
              onChange={v => {
                this.onChangeValue(
                  v, 'proxyPort'
                )
              }}
            />
          </InputGroup>
        </div>
      </div>
    )
  }

  render () {
    const {
      hotkey,
      language,
      rendererType
    } = this.props.config
    const { themes, theme } = this.props.store
    const langs = getGlobal('langs')
    const [modifier, key] = hotkey.split('+')
    return (
      <div className='form-wrap pd1y pd2x'>
        <h2>{e('settings')}</h2>
        <div className='pd1b'>{e('hotkeyDesc')}</div>
        <div className='pd2b'>
          <Select
            value={modifier}
            onChange={this.onChangeModifier}
            className='iblock width100'
            dropdownMatchSelectWidth={false}
            showSearch
          >
            {
              modifiers.map(this.renderOption)
            }
          </Select>
          <span className='iblock mg1x'>+</span>
          <Select
            value={key}
            className='iblock width100'
            onChange={this.onChangeKey}
            dropdownMatchSelectWidth={false}
            showSearch
          >
            {
              keys.map(this.renderOption)
            }
          </Select>
        </div>
        {this.renderProxy()}
        <div className='pd1b'>{e('scrollBackDesc')}</div>
        {
          this.renderNumber('scrollback', {
            step: 200,
            min: 1000
          })
        }
        <div className='pd1b'>{e('timeoutDesc')}</div>
        {
          this.renderNumber('sshReadyTimeout', {
            step: 200,
            min: 100,
            cls: 'timeout-desc'
          })
        }
        <div className='pd1b'>{e('opacity')}</div>
        {
          this.renderNumber('opacity', {
            step: 0.05,
            min: 0,
            max: 1,
            cls: 'opacity'
          })
        }
        <div className='pd1b'>{e('terminalTheme')}</div>
        <div className='pd2b'>
          <Select
            onChange={this.onChangeTerminalTheme}
            dropdownMatchSelectWidth={false}
            value={theme}
          >
            {
              themes.map(l => {
                const { id, name } = l
                return (
                  <Option key={id} value={id}>{name}</Option>
                )
              })
            }
          </Select>
        </div>
        <div className='pd1b'>{e('language')}</div>
        <div className='pd2b'>
          <Select
            onChange={this.onChangeLang}
            value={language}
            dropdownMatchSelectWidth={false}
          >
            {
              langs.map(l => {
                const { id, name } = l
                return (
                  <Option key={id} value={id}>{name}</Option>
                )
              })
            }
          </Select>
        </div>
        {this.renderLanguageChangeTip()}
        <div className='pd1y font16 bold'>
          <Icon type='code' theme='outlined' className='mg1r' />
          {s('terminal')} {e('settings')}
        </div>
        <div className='pd1b'>{e('rendererType')}</div>
        <div className='pd2b'>
          <Select
            onChange={v => this.onChangeValue(v, 'rendererType')}
            value={rendererType}
            dropdownMatchSelectWidth={false}
          >
            {
              ['canvas', 'dom'].map(id => {
                return (
                  <Option key={id} value={id}>{id}</Option>
                )
              })
            }
          </Select>
        </div>
        <div className='pd1b'>{t('default')} {e('fontSize')}</div>
        {
          this.renderNumber('fontSize', {
            step: 1,
            min: 9
          })
        }
        <div className='pd1b'>{t('default')} {e('fontFamily')}</div>
        {
          this.renderText('fontFamily')
        }
        <div className='pd1b'>{e('terminalBackgroundImage')}</div>
        {
          this.renderTerminalBgSelect('terminalBackgroundImagePath')
        }
        <div className='pd1b'>{t('default')} {e('execWindows')}</div>
        {
          this.renderText('execWindows')
        }
        <div className='pd1b'>{t('default')} {e('execMac')}</div>
        {
          this.renderText('execMac')
        }
        <div className='pd1b'>{t('default')} {e('execLinux')}</div>
        {
          this.renderText('execLinux')
        }
        {this.renderToggle('rightClickSelectsWord')}
        {this.renderToggle('copyWhenSelect')}
        {this.renderToggle('disableSshHistory')}
        {this.renderToggle('disableTransferHistory')}
        {this.renderReset()}
      </div>
    )
  }
}
