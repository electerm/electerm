/**
* btns
*/
import { Component } from 'react'
import fs from '../../common/fs'
import { noTerminalBgValue, textTerminalBgValue } from '../../common/constants'
import { generateMosaicBackground } from './shapes'

export default class CssOverwrite extends Component {
  static styleTag = null

  shouldComponentUpdate (nextProps) {
    if (!this.props.wsInited && nextProps.wsInited) {
      return true
    }

    const bgProps = [
      'terminalBackgroundImagePath',
      'terminalBackgroundFilterBlur',
      'terminalBackgroundFilterOpacity',
      'terminalBackgroundFilterBrightness',
      'terminalBackgroundFilterContrast',
      'terminalBackgroundFilterGrayscale',
      'terminalBackgroundText',
      'terminalBackgroundTextSize',
      'terminalBackgroundTextColor',
      'terminalBackgroundTextFontFamily'
    ]
    const globalChanged = bgProps.some(prop => this.props[prop] !== nextProps[prop])
    if (globalChanged) {
      return true
    }

    const currentTabs = this.props.tabs || []
    const nextTabs = nextProps.tabs || []
    if (currentTabs.length !== nextTabs.length) {
      return true
    }

    // If no tabs in both cases
    if (!currentTabs.length && !nextTabs.length) {
      return false
    }

    // Since tab bg settings never change, we only need to compare tab IDs
    const currentIds = new Set(currentTabs.map(t => t.id))
    const nextIds = new Set(nextTabs.map(t => t.id))

    // Check if all current IDs exist in next IDs
    for (const id of currentIds) {
      if (!nextIds.has(id)) return true
    }

    return false
  }

  componentDidUpdate (prevProps) {
    if (!prevProps.wsInited && this.props.wsInited) {
      setTimeout(this.writeCss, 1500)
      return
    }
    setTimeout(this.updateCss, 1000)
  }

  // Common function to handle background image style creation
  createBackgroundStyle = async (imagePath, textBgProps = null) => {
    if (!imagePath || imagePath === '') {
      return ''
    }

    let content = ''
    let st = ''
    const isWebImg = /^https?:\/\//.test(imagePath)
    if (imagePath === 'randomShape') {
      st = `url(${generateMosaicBackground()})`
    } else if (imagePath === 'index') {
      st = 'index'
    } else if (noTerminalBgValue === imagePath) {
      st = 'none'
    } else if (textTerminalBgValue === imagePath) {
      st = 'text'
    } else if (imagePath && !isWebImg) {
      content = await fs.readFileAsBase64(imagePath)
        .catch(log.error)
      if (content) {
        st = `url(data:image;base64,${content})`
      }
    } else if (imagePath && isWebImg) {
      st = `url(${imagePath})`
    }
    return st
  }

  // Common function to create filter styles
  createFilterStyle = (props, tabProps = null) => {
    return `blur(${
      (tabProps?.terminalBackgroundFilterBlur || props.terminalBackgroundFilterBlur)
  }px) opacity(${
    +(tabProps?.terminalBackgroundFilterOpacity || props.terminalBackgroundFilterOpacity)
  }) brightness(${
    +(tabProps?.terminalBackgroundFilterBrightness || props.terminalBackgroundFilterBrightness)
  }) contrast(${
    +(tabProps?.terminalBackgroundFilterContrast || props.terminalBackgroundFilterContrast)
  }) grayscale(${
    +(tabProps?.terminalBackgroundFilterGrayscale || props.terminalBackgroundFilterGrayscale)
  })`
  }

  createStyleForTab = async (tab) => {
    const bg = tab.terminalBackground || {}
    const img = bg.terminalBackgroundImagePath || this.props.terminalBackgroundImagePath
    const st = await this.createBackgroundStyle(img)

    if (!st) {
      return ''
    }

    const selector = `#container .sessions .session-${tab.id} .xterm-screen::before`
    const styles = []
    if (st === 'index') {
      styles.push(`content: '${tab.tabCount}'`)
    } else if (st === 'text') {
      const text = bg.terminalBackgroundText || this.props.terminalBackgroundText || ''
      const size = bg.terminalBackgroundTextSize || this.props.terminalBackgroundTextSize || 48
      const color = bg.terminalBackgroundTextColor || this.props.terminalBackgroundTextColor || '#ffffff'
      const fontFamily = bg.terminalBackgroundTextFontFamily || this.props.terminalBackgroundTextFontFamily || 'monospace'
      if (text) {
        styles.push(
          `content: '${text.replace(/'/g, "\\'").replace(/\n/g, '\\A ')}'`,
          `font-size: ${size}px`,
          `color: ${color}`,
          'white-space: pre-wrap',
          'word-wrap: break-word',
          'text-align: center',
          'display: flex',
          'align-items: center',
          'justify-content: center',
          `font-family: ${fontFamily}`,
          'opacity: 0.3',
          'background-image: none' // Override default background when text is set
        )
      }
    } else if (st !== 'none') {
      styles.push(
        `background-image: ${st}`,
        'background-position: center',
        `filter: ${this.createFilterStyle(this.props, tab)}`
      )
    }
    return `${selector} {
    ${styles.join(';')};
  }`
  }

  createGlobalStyle = async () => {
    const st = await this.createBackgroundStyle(this.props.terminalBackgroundImagePath)
    if (!st) {
      return '#container .session-batch-active .xterm-screen::before {' +
      'background-image: url("./images/electerm-watermark.png");' +
      '}'
    }

    const styles = []

    if (st === 'text') {
      const text = this.props.terminalBackgroundText || ''
      const size = this.props.terminalBackgroundTextSize || 48
      const color = this.props.terminalBackgroundTextColor || '#ffffff'
      const fontFamily = this.props.terminalBackgroundTextFontFamily || 'monospace'
      if (text) {
        styles.push(
          `content: '${text.replace(/'/g, "\\'").replace(/\n/g, '\\A ')}'`,
          `font-size: ${size}px`,
          `color: ${color}`,
          'white-space: pre-wrap',
          'word-wrap: break-word',
          'text-align: center',
          'display: flex',
          'align-items: center',
          'justify-content: center',
          `font-family: ${fontFamily}`,
          'opacity: 0.3',
          'background-image: none' // Override default background when text is set
        )
      }
    } else if (st !== 'none' && st !== 'index') {
      styles.push(
        `background-image: ${st}`,
        'background-position: center',
        `filter: ${this.createFilterStyle(this.props)}`
      )
    }

    return `#container .session-batch-active .xterm-screen::before {
    ${styles.join(';')};
  }`
  }

  writeCss = async () => {
    if (!CssOverwrite.styleTag) {
      CssOverwrite.styleTag = document.createElement('style')
      CssOverwrite.styleTag.type = 'text/css'
      CssOverwrite.styleTag.id = 'css-overwrite-terminal-backgrounds'
      document.getElementsByTagName('head')[0].appendChild(CssOverwrite.styleTag)
    }

    const { tabs = [] } = this.props
    const tabStyles = await Promise.all(
      tabs
        .map(tab => this.createStyleForTab(tab))
    )
    const globalStyle = await this.createGlobalStyle()
    const allStyles = [
      globalStyle,
      ...tabStyles
    ].filter(Boolean).join('\n')
    CssOverwrite.styleTag.innerHTML = allStyles
  }

  updateCss = async () => {
    await this.writeCss()
  }

  render () {
    return null
  }
}
