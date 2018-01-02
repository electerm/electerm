
import React from 'react'
import {message, Select, InputNumber} from 'antd'

const {Option} = Select
const {getGlobal} = window
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
        message.warn('hotkey can not be registe, please use another one')
        update.config.hotkey = config.hotkey
        ext.hotkey = config.hotkey
      } else {
        message.success('saved')
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

  render() {
    let {hotkey, sshReadyTimeout} = this.props.config
    let [modifier, key] = hotkey.split('+')
    return (
      <div className="form-wrap pd1y pd2x">
        <h3>settings</h3>
        <div className="pd1b">system hotkey(bring window back to front)</div>
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
        <div className="pd1b">ssh timeout(in millisecond)</div>
        <div className="pd2b">
          <InputNumber
            onChange={this.onChangeTimeout}
            step={1000}
            min={100}
            value={sshReadyTimeout}
          />
        </div>
      </div>
    )
  }

}

