
import React from 'react'
import {
  message, Select, Switch,
  InputNumber, Alert, Button
} from 'antd'

const {Option} = Select
const {getGlobal, prefix} = window
const e = prefix('setting')
const s = prefix('ssh')
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

export default class Setting extends React.Component {

  state = {
    languageChanged: false
  }

  restart = () => {
    getGlobal('restart')()
  }

  onChangeModifier = modifier => {
    let {hotkey} = this.props.config
    let key = hotkey.split('+')[1]
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
    let {hotkey} = this.props.config
    let modifier = hotkey.split('+')[0]
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

  onChangeScrollBack = scrollback => {
    this.setState({
      scrollback
    })
    return this.saveConfig({
      scrollback
    })
  }

  onChangeTerminalTheme = id => {
    this.props.setTheme(id)
  }

  onToggle = (value, name) => {
    this.saveConfig({
      [name]: value
    })
  }

  saveConfig = (_ext) => {
    let {config} = this.props
    let ext = _ext
    let update = {
      config: Object.assign({}, config, ext)
    }
    const saveUserConfig = getGlobal('saveUserConfig')
    if (ext.hotkey && ext.hotkey !== config.hotkey) {
      const changeHotkey = getGlobal('changeHotkey')
      let res = changeHotkey(ext.hotkey)
      if (!res) {
        message.warn(e('hotkeyNotOk'))
        update.config.hotkey = config.hotkey
        ext.hotkey = config.hotkey
      } else {
        message.success(e('saved'))
      }
    }
    saveUserConfig && saveUserConfig(ext)
    this.props.modifier(update)
  }

  renderOption = (m, i) => {
    return (
      <Option value={m} key={m + 'opt' + i}>{m}</Option>
    )
  }

  renderToggle = name => {
    let checked = !!this.props.config[name]
    return (
      <div className="pd2b">
        <Switch
          checked={checked}
          checkedChildren={e(name)}
          unCheckedChildren={e(name)}
          onChange={v => this.onToggle(v, name)}
        />
      </div>
    )
  }

  renderLanguageChangeTip = () => {
    if (!this.state.languageChanged) {
      return null
    }
    return (
      <div className="pd1t">
        <Alert
          message={
            <div>
              {e('saveLang')}
              <Button
                onClick={this.restart}
                className="mg1l"
              >
                {e('restartNow')}
              </Button>
            </div>
          }
          type="success"
        />
      </div>
    )
  }

  render() {
    let {
      hotkey,
      sshReadyTimeout,
      language,
      scrollback
    } = this.props.config
    let {themes, theme} = this.props
    let langs = getGlobal('langs')
    let [modifier, key] = hotkey.split('+')
    return (
      <div className="form-wrap pd1y pd2x">
        <h3>{e('settings')}</h3>
        <div className="pd1b">{e('hotkeyDesc')}</div>
        <div className="pd2b">
          <Select
            value={modifier}
            onChange={this.onChangeModifier}
            className="iblock width100"
            dropdownMatchSelectWidth={false}
            showSearch
          >
            {
              modifiers.map(this.renderOption)
            }
          </Select>
          <span className="iblock mg1x">+</span>
          <Select
            value={key}
            className="iblock width100"
            onChange={this.onChangeKey}
            dropdownMatchSelectWidth={false}
            showSearch
          >
            {
              keys.map(this.renderOption)
            }
          </Select>
        </div>
        <div className="pd1b">{e('scrollBackDesc')}</div>
        <div className="pd2b">
          <InputNumber
            onChange={this.onChangeScrollBack}
            step={200}
            min={1000}
            value={scrollback}
          />
        </div>
        <div className="pd1b">{e('timeoutDesc')}</div>
        <div className="pd2b timeout-desc">
          <InputNumber
            onChange={this.onChangeTimeout}
            step={1000}
            min={100}
            value={sshReadyTimeout}
          />
        </div>
        <div className="pd1b">{e('terminalTheme')}</div>
        <div className="pd2b">
          <Select
            onChange={this.onChangeTerminalTheme}
            dropdownMatchSelectWidth={false}
            value={theme}
          >
            {
              themes.map(l => {
                let {id, name} = l
                return (
                  <Option key={id} value={id}>{name}</Option>
                )
              })
            }
          </Select>
        </div>
        <div className="pd1b">{e('language')}</div>
        <div className="pd2b">
          <Select
            onChange={this.onChangeLang}
            value={language}
            dropdownMatchSelectWidth={false}
          >
            {
              langs.map(l => {
                let {id, name} = l
                return (
                  <Option key={id} value={id}>{name}</Option>
                )
              })
            }
          </Select>
        </div>
        {this.renderLanguageChangeTip()}
        <div className="pd1b">
          {s('terminal')} {e('settings')} 
        </div>
        {this.renderToggle('copyWhenSelect')}
        {this.renderToggle('pasteWhenContextMenu')}
      </div>
    )
  }

}

