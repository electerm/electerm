import React, { Component } from 'react'
import {
  ArrowRightOutlined,
  LoadingOutlined,
  SunOutlined,
  MoonOutlined
} from '@ant-design/icons'
import {
  message,
  Select,
  Switch,
  Input,
  InputNumber,
  Alert,
  Button,
  Table,
  Space,
  Tag
} from 'antd'
import deepCopy from 'json-deep-copy'
import {
  settingMap,
  proxyHelpLink
} from '../../common/constants'
import defaultSettings from '../../common/default-setting'
import Link from '../common/external-link'
import { isNumber, isNaN } from 'lodash-es'
import createEditLangLink from '../../common/create-lang-edit-link'
import StartSession from './start-session-select'
import HelpIcon from '../common/help-icon'
import delay from '../../common/wait.js'
import isColorDark from '../../common/is-color-dark'
import './setting.styl'

const { Option } = Select
const e = window.translate

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

export default class SettingCommon extends Component {
  state = {
    ready: false,
    languageChanged: false,
    passwordChanged: false,
    submittingPass: false,
    passInputFocused: false,
    placeholderLogin: window.pre.requireAuth ? '********' : e('notSet'),
    loginPass: ''
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
    clearTimeout(this.timer1)
  }

  handleLoginSubmit = async () => {
    if (this.submitting) {
      return
    }
    this.submitting = true
    this.setState({
      submittingPass: true
    })
    const pass = this.state.loginPass
    const r = await window.pre.runGlobalAsync(
      'setPassword',
      pass
    )
    await delay(600)
    if (r === true) {
      window.pre.requireAuth = !!pass
      this.setState({
        loginPass: pass ? '********' : '',
        submittingPass: false,
        passwordChanged: true,
        placeholderLogin: pass ? '********' : e('notSet')
      }, () => {
        this.submitting = false
      })
      message.success('OK')
    } else {
      this.setState({
        submittingPass: false
      }, () => {
        this.submitting = false
      })
    }
  }

  handleLoginPassFocus = () => {
    this.setState({
      passInputFocused: true
    })
  }

  blurPassInput = () => {
    this.setState({
      passInputFocused: false
    })
  }

  handleLoginPassBlur = () => {
    this.timer1 = setTimeout(
      this.blurPassInput, 300
    )
  }

  handleChangeLoginPass = e => {
    this.setState({
      loginPass: e.target.value
    })
  }

  handleRestart = () => {
    window.location.reload()
  }

  handleResetAll = () => {
    this.saveConfig(
      deepCopy(defaultSettings)
    )
  }

  handleChangeModifier = modifier => {
    const { hotkey } = this.props.config
    const key = hotkey.split('+')[1]
    return this.saveConfig({
      hotkey: `${modifier}+${key}`
    })
  }

  onChangeTimeout = sshReadyTimeout => {
    return this.saveConfig({
      sshReadyTimeout
    })
  }

  handleChangeKey = key => {
    const { hotkey } = this.props.config
    const modifier = hotkey.split('+')[0]
    return this.saveConfig({
      hotkey: `${modifier}+${key}`
    })
  }

  handleChangeLang = language => {
    this.setState({
      languageChanged: true
    })
    return this.saveConfig({
      language
    })
  }

  handleChangeTerminalTheme = id => {
    this.props.store.setTheme(id)
  }

  handleCustomCss = (e) => {
    this.onChangeValue(e.target.value, 'customCss')
  }

  onChangeValue = (value, name) => {
    if (name === 'useSystemTitleBar') {
      message.info(e('useSystemTitleBarTip'), 5)
    }
    if (name === 'disableConnectionHistory' && value) {
      window.store.history = []
    }
    this.saveConfig({
      [name]: value
    })
  }

  onChangeStartSessions = value => {
    this.onChangeValue(value, 'onStartSessions')
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

  renderRestart = (name) => {
    if (!this.state[name]) {
      return null
    }
    return (
      <div className='pd1t'>
        <Alert
          message={
            <div>
              {e('saveLang')}
              <Button
                onClick={this.handleRestart}
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

  renderNumber = (name, options, title = '', width = '100%') => {
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
        width
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
    const styleArg = {
      style: {
        width: '40%'
      }
    }
    return (
      <div className='pd2b'>
        <Space.Compact block>
          <Input
            value={value}
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
            {e('global')} {e('proxy')}
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

  renderLoginPassAfter () {
    const {
      loginPass,
      submittingPass,
      passInputFocused
    } = this.state
    if (!loginPass && !passInputFocused) {
      return null
    } else if (
      submittingPass
    ) {
      return <LoadingOutlined />
    }
    return (
      <ArrowRightOutlined
        className='pointer'
        onClick={this.handleLoginSubmit}
      />
    )
  }

  renderLoginPass () {
    if (window.et.isWebApp) {
      return null
    }
    const {
      loginPass,
      submittingPass,
      placeholderLogin
    } = this.state
    const props = {
      value: loginPass,
      disabled: submittingPass,
      onFocus: this.handleLoginPassFocus,
      onBlur: this.handleLoginPassBlur,
      onChange: this.handleChangeLoginPass,
      addonAfter: this.renderLoginPassAfter(),
      placeholder: placeholderLogin
    }
    return (
      <div>
        <div className='pd1b'>{e('loginPassword')}</div>
        <div className='pd2b'>
          <Input.Password
            {...props}
          />
        </div>
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
    const { props } = this
    const {
      hotkey,
      language,
      theme,
      customCss
    } = props.config
    const {
      langs = []
    } = window.et
    const terminalThemes = props.store.getSidebarList(settingMap.terminalThemes)
    const [modifier, key] = hotkey.split('+')
    const pops = {
      onStartSessions: props.config.onStartSessions,
      bookmarks: props.bookmarks,
      bookmarkGroups: props.bookmarkGroups,
      onChangeStartSessions: this.onChangeStartSessions
    }
    return (
      <div className='form-wrap pd1y pd2x'>
        <h2>{e('settings')}</h2>
        <div className='pd1b'>{e('hotkeyDesc')}</div>
        <div className='pd2b'>
          <Select
            value={modifier}
            onChange={this.handleChangeModifier}
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
            onChange={this.handleChangeKey}
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
            {...pops}
          />
        </div>
        {this.renderProxy()}
        {
          this.renderNumber('sshReadyTimeout', {
            step: 200,
            min: 100,
            cls: 'timeout-desc'
          }, e('timeoutDesc'))
        }
        {
          this.renderNumber('keepaliveInterval', {
            step: 1000,
            min: 0,
            max: 20000000,
            cls: 'keepalive-interval-desc',
            extraDesc: '(ms)'
          }, e('keepaliveIntervalDesc'))
        }
        {
          this.renderNumber('opacity', {
            step: 0.05,
            min: 0,
            max: 1,
            cls: 'opacity'
          }, e('opacity'))
        }

        <div className='pd2b'>
          <span className='inline-title mg1r'>{e('uiThemes')}</span>
          <Select
            onChange={this.handleChangeTerminalTheme}
            popupMatchSelectWidth={false}
            value={theme}
          >
            {
              terminalThemes.map(l => {
                const { id, name, uiThemeConfig } = l
                const { main, text } = uiThemeConfig
                const isDark = isColorDark(main)
                const txt = isDark ? <MoonOutlined /> : <SunOutlined />
                const tag = (
                  <Tag
                    color={main}
                    className='mg1l'
                    style={
                      {
                        color: text
                      }
                    }
                  >
                    {txt}
                  </Tag>
                )
                return (
                  <Option key={id} value={id}>
                    {tag} {name}
                  </Option>
                )
              })
            }
          </Select>
        </div>

        <div className='pd2b'>
          <span className='inline-title mg1r'>{e('customCss')}</span>
          <Input.TextArea
            onChange={this.handleCustomCss}
            value={customCss}
            rows={3}
          />
        </div>

        <div className='pd2b'>
          <span className='inline-title mg1r'>{e('language')}</span>
          <Select
            onChange={this.handleChangeLang}
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
          <Link className='mg1l' to={createEditLangLink(language)}>{e('edit')}</Link>
        </div>
        {this.renderRestart('languageChanged')}
        <div className='pd1b'>{e('default')} {e('execWindows')}</div>
        {
          this.renderTextExec('execWindows')
        }
        <div className='pd1b'>{e('default')} {e('execMac')}</div>
        {
          this.renderTextExec('execMac')
        }
        <div className='pd1b'>{e('default')} {e('execLinux')}</div>
        {
          this.renderTextExec('execLinux')
        }
        {
          [
            'autoRefreshWhenSwitchToSftp',
            'showHiddenFilesOnSftpStart',
            'screenReaderMode',
            'initDefaultTabOnStart',
            'disableConnectionHistory',
            'disableTransferHistory',
            'checkUpdateOnStart',
            'useSystemTitleBar',
            'confirmBeforeExit',
            'hideIP',
            'debug'
          ].map(this.renderToggle)
        }
        {this.renderLoginPass()}
        {this.renderReset()}
      </div>
    )
  }
}
