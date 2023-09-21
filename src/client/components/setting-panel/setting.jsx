
import React, { Component } from 'react'
import { CodeOutlined, LoadingOutlined } from '@ant-design/icons'
import {
  message,
  Select,
  Switch,
  Input,
  Upload,
  InputNumber,
  Alert,
  Button,
  AutoComplete,
  Tooltip,
  Table,
  Space
} from 'antd'
import deepCopy from 'json-deep-copy'
import {
  noTerminalBgValue,
  settingMap,
  rendererTypes,
  proxyHelpLink,
  isWin
} from '../../common/constants'
import defaultSettings from '../../../app/common/default-setting'
import ShowItem from '../common/show-item'
import { osResolve } from '../../common/resolve'
import Link from '../common/external-link'
import { isNumber, isNaN } from 'lodash-es'
import createEditLangLink from '../../common/create-lang-edit-link'
import mapper from '../../common/auto-complete-data-mapper'
import StartSession from './start-session-select'
import HelpIcon from '../common/help-icon'
import fs from '../../common/fs'
import './setting.styl'

const { Option } = Select
const { prefix } = window
const e = prefix('setting')
const f = prefix('form')
const s = prefix('ssh')
const p = prefix('sftp')
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
    ready: false,
    languageChanged: false
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

  restart = () => {
    window.location.reload()
  }

  resetAll = () => {
    this.saveConfig(
      deepCopy(defaultSettings)
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
    if (name === 'useSystemTitleBar') {
      message.info(e('useSystemTitleBarTip'), 5)
    }
    this.saveConfig({
      [name]: value
    })
  }

  onChangeStartSessions = value => {
    this.onChangeValue(value, 'onStartSessions')
  }

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

  saveConfig = async (_ext) => {
    const config = deepCopy(this.props.config)
    const ext = deepCopy(_ext)
    const update = Object.assign({}, config, deepCopy(_ext))
    if (ext.hotkey && ext.hotkey !== config.hotkey) {
      const res = await window.pre.runGlobalAsync('changeHotkey', ext.hotkey)
      if (!res) {
        message.warning(e('hotkeyNotOk'))
        update.config.hotkey = config.hotkey
        ext.hotkey = config.hotkey
      } else {
        message.success(e('saved'))
      }
    }
    this.props.store.setConfig(update)
  }

  renderOption = (m, i) => {
    return (
      <Option value={m} key={m + 'opt' + i}>{m}</Option>
    )
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

  renderTextExec = (name) => {
    const agrsProp = `${name}Args`
    const args = this.props.config[agrsProp]
    const value = this.props.config[name]
    const defaultValue = defaultSettings[name]
    const onChange = (e) => this.onChangeValue(e.target.value, name)
    const onChangeArgs = (v) => this.onChangeValue(v, agrsProp)
    const style = {
      style: {
        width: '40%'
      }
    }
    const styleArg = {
      style: {
        width: '40%',
        marginLeft: '3px'
      }
    }
    return (
      <div className='pd2b'>
        <Space.Compact>
          <Input
            value={value}
            {...style}
            onChange={onChange}
            placeholder={defaultValue}
          />
          <Select
            {...styleArg}
            placeholder='args'
            onChange={onChangeArgs}
            value={args}
            mode='tags'
          >
            {
              args.map((arg, i) => {
                return (
                  <Option key={arg + '__' + i} value={arg}>
                    {arg}
                  </Option>
                )
              })
            }
          </Select>
        </Space.Compact>
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
          onClick={this.resetAll}
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

  renderProxy () {
    const {
      enableGlobalProxy
    } = this.props.config
    const helps = `http# http://proxy-server-over-tcp.com:3128
      https#https://proxy-server-over-tls.com:3129
      socks(v5)#socks://username:password@some-socks-proxy.com:9050 (username & password are optional)
      socks5#socks5://username:password@some-socks-proxy.com:9050 (username & password are optional)
      socks5h#socks5h://username:password@some-socks-proxy.com:9050 (username & password are optional)
      socks4#socks4://some-socks-proxy.com:9050
      socks4a#socks4a://some-socks-proxy.com:9050`
      .split('\n')
      .filter(d => d.trim())
      .map(d => {
        const [protocol, example] = d.split('#')
        return {
          protocol, example
        }
      })
    const cols = Object.keys(helps[0]).map(k => {
      return {
        title: k,
        dataIndex: k,
        key: k,
        render: (k) => k || ''
      }
    })
    const table = (
      <div>
        <Table
          columns={cols}
          dataSource={helps}
          bordered
          pagination={false}
          size='small'
          rowKey='protocol'
        />
        <div>
          <Link to={proxyHelpLink}>{proxyHelpLink}</Link>
        </div>
      </div>
    )
    const style = {
      height: '414px',
      width: '500px'
    }
    return (
      <div className='pd1b'>
        <div className='pd1b'>
          <span className='pd1r'>
            {e('global')} {f('proxy')}
            <HelpIcon
              title={table}
              overlayInnerStyle={style}
            />
          </span>
          <Switch
            checked={enableGlobalProxy}
            onChange={v => {
              this.onChangeValue(v, 'enableGlobalProxy')
            }}
          />
        </div>
        {
          this.renderText('proxy', 'socks5://127.0.0.1:1080')
        }
      </div>
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
      onChange: this.handleChangeFont,
      value: fontFamily.split(/, */g)
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
                <span style={{
                  fontFamily: f
                }}>{f}</span>
              </Option>
            )
          })
        }
      </Select>
    )
  }

  handlePortable = async () => {
    const {
      appPath,
      exePath
    } = this.props.store
    const from = osResolve(appPath, 'electerm', 'users')
    const tar = osResolve(exePath, 'electerm', 'users')
    const cmd = `xcopy /E /I /Q /Y "${from}" ${tar}`
    const x = await fs.runWinCmd(cmd)
      .catch(err => {
        this.props.store.onError(err)
        return false
      })
    if (x !== false) {
      message.success(
        `${e('dataTransferedTo')}: ${tar}`
      )
      setTimeout(
        this.props.store.restart, 5000
      )
    }
  }

  renderMakePortable () {
    const {
      isPortable
    } = this.props.store
    if (!isWin || isPortable) {
      return null
    }
    return (
      <div className='pd1y'>
        <Button
          onClick={this.handlePortable}
        >
          {e('makeItPortable')}
        </Button>
      </div>
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
      hotkey,
      language,
      rendererType,
      theme
    } = this.props.config
    const {
      appPath,
      langs
    } = this.props.store
    const terminalLogPath = osResolve(appPath, 'electerm', 'session_logs')
    const terminalThemes = this.props.store.getSidebarList(settingMap.terminalThemes)
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
            popupMatchSelectWidth={false}
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
            popupMatchSelectWidth={false}
            showSearch
          >
            {
              keys.map(this.renderOption)
            }
          </Select>
        </div>
        <div className='pd1b'>{e('onStartBookmarks')}</div>
        <div className='pd2b'>
          <StartSession
            onStartSessions={this.props.config.onStartSessions}
            store={this.props.store}
            onChangeStartSessions={this.onChangeStartSessions}
          />
        </div>
        {this.renderProxy()}
        {
          this.renderNumber('scrollback', {
            step: 200,
            min: 1000
          }, e('scrollBackDesc'), 400)
        }
        {
          this.renderNumber('sshReadyTimeout', {
            step: 200,
            min: 100,
            cls: 'timeout-desc'
          }, e('timeoutDesc'), 400)
        }
        {
          this.renderNumber('keepaliveInterval', {
            step: 1000,
            min: 0,
            max: 20000000,
            cls: 'keepalive-interval-desc',
            extraDesc: '(ms)'
          }, e('keepaliveIntervalDesc'), 400)
        }
        {
          this.renderNumber('opacity', {
            step: 0.05,
            min: 0,
            max: 1,
            cls: 'opacity'
          }, e('opacity'), 400)
        }

        <div className='pd2b'>
          <span className='inline-title mg1r'>{e('terminalTheme')}</span>
          <Select
            onChange={this.onChangeTerminalTheme}
            popupMatchSelectWidth={false}
            value={theme}
          >
            {
              terminalThemes.map(l => {
                const { id, name } = l
                return (
                  <Option key={id} value={id}>{name}</Option>
                )
              })
            }
          </Select>
        </div>
        <div className='pd2b'>
          <span className='inline-title mg1r'>{e('language')}</span>
          <Select
            onChange={this.onChangeLang}
            value={language}
            popupMatchSelectWidth={false}
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
          <Link className='mg1l' to={createEditLangLink(language)}>{p('edit')}</Link>
        </div>
        {this.renderLanguageChangeTip()}
        <div className='pd1y font16 bold'>
          <CodeOutlined className='mg1r' />
          {s('terminal')} {e('settings')}
        </div>
        <div className='pd2b'>
          <span className='inline-title mg1r'>{e('rendererType')}</span>
          <Select
            onChange={v => this.onChangeValue(v, 'rendererType')}
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
          <span className='inline-title mg1r'>{e('defaultTerminalType')}</span>
          {
            this.renderDefaultTerminalType()
          }
        </div>
        <div className='pd1b'>{e('terminalBackgroundImage')}</div>
        {
          this.renderTerminalBgSelect('terminalBackgroundImagePath')
        }
        <div className='pd1b'>{t('default')} {e('editorTip')}</div>
        {
          this.renderText('defaultEditor', e('editorTip'))
        }
        <div className='pd1b'>{t('default')} {e('execWindows')}</div>
        {
          this.renderTextExec('execWindows')
        }
        <div className='pd1b'>{t('default')} {e('execMac')}</div>
        {
          this.renderTextExec('execMac')
        }
        <div className='pd1b'>{t('default')} {e('execLinux')}</div>
        {
          this.renderTextExec('execLinux')
        }
        {
          this.renderCursorStyleSelect()
        }
        {
          [
            'autoRefreshWhenSwitchToSftp',
            'screenReaderMode',
            'initDefaultTabOnStart',
            'cursorBlink',
            'rightClickSelectsWord',
            'pasteWhenContextMenu',
            'copyWhenSelect',
            'disableSshHistory',
            'disableTransferHistory',
            'ctrlOrMetaOpenTerminalLink',
            'checkUpdateOnStart',
            'useSystemTitleBar',
            'confirmBeforeExit',
            'debug'
          ].map(this.renderToggle)
        }
        {this.renderToggle('saveTerminalLogToFile', (
          <ShowItem to={terminalLogPath} className='mg1l'>{p('open')}</ShowItem>
        ))}
        {
          this.renderMakePortable()
        }
        {this.renderReset()}
      </div>
    )
  }
}
