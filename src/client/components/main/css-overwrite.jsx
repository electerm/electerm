/**
 * btns
 */

import { PureComponent } from 'react'
import fs from '../../common/fs'
import { noTerminalBgValue } from '../../common/constants'

export default class SystemMenu extends PureComponent {
  componentDidMount () {
    this.writeCss()
  }

  componentDidUpdate (prevProps) {
    if (prevProps.terminalBackgroundImagePath !== this.props.terminalBackgroundImagePath) {
      this.updateCss()
    }
  }

  createStyle = async () => {
    const { terminalBackgroundImagePath } = this.props
    let content = ''
    let st = ''
    const isWebImg = /^https?:\/\//.test(terminalBackgroundImagePath)
    if (noTerminalBgValue === terminalBackgroundImagePath) {
      st = 'none'
    } else if (terminalBackgroundImagePath && !isWebImg) {
      content = await fs.readFileAsBase64(terminalBackgroundImagePath)
        .catch(console.log)
      if (content) {
        st = `url(data:image;base64,${content})`
      }
    } else if (terminalBackgroundImagePath && isWebImg) {
      st = `url(${terminalBackgroundImagePath})`
    }
    return st
      ? `
    #container .xterm-viewport {
      background-image: ${st};
    }
    `
      : ''
  }

  writeCss = async () => {
    const style = document.createElement('style')
    style.type = 'text/css'
    style.innerHTML = await this.createStyle()
    style.id = 'css-overwrite'
    document.getElementsByTagName('head')[0].appendChild(style)
  }

  updateCss = async () => {
    const style = document.getElementById('css-overwrite')
    style.innerHTML = await this.createStyle()
  }

  render () {
    return null
  }
}
