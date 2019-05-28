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
    let style = document.createElement('style')
    style.type = 'text/css'
    let { terminalBackgroundImagePath } = this.props
    let content = ''
    if (terminalBackgroundImagePath) {
      content = await fs.readFileAsBase64(terminalBackgroundImagePath)
        .catch(console.log)
    }
    style.innerHTML = content
      ? `
    .xterm-viewport {
      background-image: url(data:image;base64,${content});
    }
    `
      : ''
    style.id = 'css-overwrite'
    document.getElementsByTagName('head')[0].appendChild(style)
  }

  updateCss = async () => {
    let style = document.getElementById('css-overwrite')
    let { terminalBackgroundImagePath } = this.props
    let content = ''
    if (terminalBackgroundImagePath) {
      content = await fs.readFileAsBase64(terminalBackgroundImagePath)
        .catch(console.log)
    }
    style.innerHTML = content
      ? `
    .xterm-viewport {
      background-image: url(data:image;base64,${content});
    }
    `
      : ''
  }

  render () {
    return null
  }
}
