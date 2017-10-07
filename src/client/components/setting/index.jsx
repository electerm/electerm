
import React from 'react'
import {message} from 'antd'

const {getGlobal} = window

export default class Setting extends React.Component {

  saveConfig = (ext) => {
    let {config} = this.props
    let update = {
      config: Object.assign({}, config, ext)
    }
    const saveUserConfig = getGlobal('saveUserConfig')
    saveUserConfig && saveUserConfig(ext)
    if (ext.hotkey && ext.hotkey !== config.hotkey) {
      const changeHotkey = getGlobal('changeHotkey')
      let res = changeHotkey(ext.hotkey)
      if (!res) {
        message.warn('hotkey can not be registe, please use another one')
        update.config.hotkey = config.hotkey
      }
    }
    this.props.modifier(update)
  }

  render() {
    return (
      <div className="form-wrap pd1y pd2x">settings</div>
    )
  }

}

