/**
 * btns
 */

import { PureComponent } from 'react'
import fs from '../../common/fs'
import { noTerminalBgValue } from '../../common/constants'

export default class CssOverwrite extends PureComponent {
  // componentDidMount () {
  //   setTimeout(this.writeCss, 3000)
  // }

  componentDidUpdate (prevProps) {
    Object.keys(this.props).some(key => {
      if (key.startsWith('terminalBackground') && prevProps[key] !== this.props[key]) {
        this.updateCss()
        return true
      }
      return false
    })
    if (!prevProps.wsInited && this.props.wsInited) {
      this.writeCss()
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
        .catch(log.error)
      if (content) {
        st = `url(data:image;base64,${content}) !important`
      }
    } else if (terminalBackgroundImagePath && isWebImg) {
      st = `url(${terminalBackgroundImagePath}) !important`
    }
    if (!st) {
      return `#container .session-batch-active .xterm-screen::before {
        background-image: url("./images/electerm-watermark.png");
      }`
    }

    const styles = [
      `background-image: ${st}`,
      'background-position: center'
    ]

    if (st !== 'none') {
      styles.push(`filter: blur(${
        this.props.terminalBackgroundFilterBlur
      }px) opacity(${
        +this.props.terminalBackgroundFilterOpacity
      }) brightness(${
        +this.props.terminalBackgroundFilterBrightness
      }) contrast(${
        +this.props.terminalBackgroundFilterContrast
      }) grayscale(${
        +this.props.terminalBackgroundFilterGrayscale
      })`)
    }

    return `#container .session-batch-active .xterm-screen::before {
      ${styles.join(';')} 
    }`
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
    if (style) {
      style.innerHTML = await this.createStyle()
    }
  }

  render () {
    return null
  }
}
