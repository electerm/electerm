/**
* btns
*/
import { PureComponent } from 'react'
import fs from '../../common/fs'
import { noTerminalBgValue } from '../../common/constants'

export default class CssOverwrite extends PureComponent {
  static styleTag = null

  shouldComponentUpdate (nextProps) {
    // Add wsInited check
    if (!this.props.wsInited && nextProps.wsInited) {
      return true
    }

    const bgProps = [
      'terminalBackgroundImagePath',
      'terminalBackgroundFilterBlur',
      'terminalBackgroundFilterOpacity',
      'terminalBackgroundFilterBrightness',
      'terminalBackgroundFilterContrast',
      'terminalBackgroundFilterGrayscale'
    ]

    // Check if global settings changed
    const globalChanged = bgProps.some(prop => this.props[prop] !== nextProps[prop])
    if (globalChanged) return true

    const currentTabs = this.props.tabs || []
    const nextTabs = nextProps.tabs || []

    // If no tabs in both cases
    if (!currentTabs.length && !nextTabs.length) return false

    // Since tab bg settings never change, we only need to compare tab IDs
    const currentIds = new Set(currentTabs.map(t => t.id))
    const nextIds = new Set(nextTabs.map(t => t.id))

    if (currentIds.size !== nextIds.size) return true

    // Check if all current IDs exist in next IDs
    for (const id of currentIds) {
      if (!nextIds.has(id)) return true
    }

    return false
  }

  componentDidUpdate (prevProps) {
    // Add wsInited check
    if (!prevProps.wsInited && this.props.wsInited) {
      this.writeCss()
      return
    }
    this.updateCss()
  }

  // Common function to handle background image style creation
  createBackgroundStyle = async (imagePath, fs) => {
    if (!imagePath || imagePath === '') {
      return ''
    }

    let content = ''
    let st = ''
    const isWebImg = /^https?:\/\//.test(imagePath)

    if (noTerminalBgValue === imagePath) {
      st = 'none'
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
    const st = await this.createBackgroundStyle(tab.terminalBackgroundImagePath, fs)

    if (!st) {
      return ''
    }

    const selector = `#container > .sessions .session-${tab.id} .xterm-screen::before`
    const styles = [
    `background-image: ${st}`,
    'background-position: center'
    ]

    if (st !== 'none') {
      styles.push(`filter: ${this.createFilterStyle(this.props, tab)}`)
    }

    return `${selector} {
    ${styles.join(';')};
  }`
  }

  createGlobalStyle = async () => {
    const st = await this.createBackgroundStyle(this.props.terminalBackgroundImagePath, fs)

    if (!st) {
      return '#container .session-batch-active .xterm-screen::before {' +
      'background-image: url("./images/electerm-watermark.png");' +
      '}'
    }

    const styles = [
    `background-image: ${st}`,
    'background-position: center'
    ]

    if (st !== 'none') {
      styles.push(`filter: ${this.createFilterStyle(this.props)}`)
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

    // Generate styles for tabs with custom backgrounds
    const tabStyles = await Promise.all(
      tabs
        .filter(tab => tab.terminalBackgroundImagePath)
        .map(tab => this.createStyleForTab(tab))
    )

    // Generate global style if exists
    const globalStyle = await this.createGlobalStyle()

    // Combine all styles
    const allStyles = [
      globalStyle,
      ...tabStyles
    ].filter(Boolean).join('\n')

    // Update style tag content
    CssOverwrite.styleTag.innerHTML = allStyles
  }

  updateCss = async () => {
    await this.writeCss()
  }

  render () {
    return null
  }
}
