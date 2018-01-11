
import React from 'react'
import {message, Select, InputNumber, Alert, Button} from 'antd'

const {Option} = Select
const {getGlobal, prefix} = window
const e = prefix('setting')
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
    let {hotkey, sshReadyTimeout, language} = this.props.config
    let langs = getGlobal('langs')
    let [modifier, key] = hotkey.split('+')
    return (
      <div className="form-wrap pd1y pd2x">
        <h3>settings</h3>
        <div className="pd1b">{e('hotkeyDesc')}</div>
        <div className="pd2b">
          <Select
            value={modifier}
            onChange={this.onChangeModifier}
            className="iblock width100"
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
            showSearch
          >
            {
              keys.map(this.renderOption)
            }
          </Select>
        </div>
        <div className="pd1b">{e('timeoutDesc')}</div>
        <div className="pd2b">
          <InputNumber
            onChange={this.onChangeTimeout}
            step={1000}
            min={100}
            value={sshReadyTimeout}
          />
        </div>
        <div className="pd1b">{e('language')}</div>
        <div className="pd2b">
          <Select
            onChange={this.onChangeLang}
            value={language}
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
      </div>
    )
  }

}

