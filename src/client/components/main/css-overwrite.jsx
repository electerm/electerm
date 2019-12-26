/**
 * btns
 */

import { PureComponent } from 'react'
import fs from '../../common/fs'

export default class SystemMenu extends PureComponent {
  componentDidMount () {
    this.writeCss()
  }

  componentDidUpdate (prevProps) {
    if (prevProps.terminalBackgroundImagePath !== this.props.terminalBackgroundImagePath) {
      this.updateCss()
    }
  }

  writeCss = async () => {
    const style = document.createElement('style')
    style.type = 'text/css'
    const { terminalBackgroundImagePath } = this.props
    let content = ''
    let st = ''
    const isWebImg = /^https?:\/\//.test(terminalBackgroundImagePath)
    if (terminalBackgroundImagePath && !isWebImg) {
      content = await fs.readFileAsBase64(terminalBackgroundImagePath)
        .catch(console.log)
      if (content) {
        st = `url(data:image;base64,${content})`
      }
    } else if (terminalBackgroundImagePath && isWebImg) {
      st = `url(${terminalBackgroundImagePath})`
    }
    style.innerHTML = st
      ? `
    #container .xterm-viewport {
      background-image: ${st};
    }
    `
      : ''
    style.id = 'css-overwrite'
    document.getElementsByTagName('head')[0].appendChild(style)
  }

  updateCss = async () => {
    const style = document.getElementById('css-overwrite')
    const { terminalBackgroundImagePath } = this.props
    let content = ''
    if (terminalBackgroundImagePath) {
      content = await fs.readFileAsBase64(terminalBackgroundImagePath)
        .catch(console.log)
    }
    style.innerHTML = content
      ? `
    #container .xterm .xterm-viewport {
      background-image: url(data:image;base64,${content});
    }
    `
      : ''
  }

  render () {
    return null
  }
}
