/**
* btns
*/
import { PureComponent } from 'react'
import fs from '../../common/fs'
import { noTerminalBgValue } from '../../common/constants'

export default class CssOverwrite extends PureComponent {
  static styleTag = null

  shouldComponentUpdate(nextProps) {
    // Check global background settings
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

  componentDidUpdate() {
    this.updateCss()
  }

  createStyleForTab = async (tab) => {
    if (!tab.terminalBackgroundImagePath || tab.terminalBackgroundImagePath === '') {
      return ''
    }

    let content = ''
    let st = ''
    const isWebImg = /^https?:\/\//.test(tab.terminalBackgroundImagePath)
    
    if (noTerminalBgValue === tab.terminalBackgroundImagePath) {
      st = 'none'
    } else if (tab.terminalBackgroundImagePath && !isWebImg) {
      content = await fs.readFileAsBase64(tab.terminalBackgroundImagePath)
        .catch(log.error)
      if (content) {
        st = `url(data:image;base64,${content})`
      }
    } else if (tab.terminalBackgroundImagePath && isWebImg) {
      st = `url(${tab.terminalBackgroundImagePath})`
    }

    if (!st) {
      return ''
    }

    const selector = `#container > .sessions .session-${tab.id} .xterm-screen::before`
    const styles = [
      `background-image: ${st}`,
      'background-position: center'
    ]

    if (st !== 'none') {
      styles.push(`filter: blur(${
        tab.terminalBackgroundFilterBlur || this.props.terminalBackgroundFilterBlur
      }px) opacity(${
        +(tab.terminalBackgroundFilterOpacity || this.props.terminalBackgroundFilterOpacity)
      }) brightness(${
        +(tab.terminalBackgroundFilterBrightness || this.props.terminalBackgroundFilterBrightness)
      }) contrast(${
        +(tab.terminalBackgroundFilterContrast || this.props.terminalBackgroundFilterContrast)
      }) grayscale(${
        +(tab.terminalBackgroundFilterGrayscale || this.props.terminalBackgroundFilterGrayscale)
      })`)
    }

    return `${selector} {
      ${styles.join(';')};
    }`
  }

  createGlobalStyle = async () => {
    if (!this.props.terminalBackgroundImagePath || this.props.terminalBackgroundImagePath === '') {
      return ''
    }

    let content = ''
    let st = ''
    const isWebImg = /^https?:\/\//.test(this.props.terminalBackgroundImagePath)
    
    if (noTerminalBgValue === this.props.terminalBackgroundImagePath) {
      st = 'none'
    } else if (this.props.terminalBackgroundImagePath && !isWebImg) {
      content = await fs.readFileAsBase64(this.props.terminalBackgroundImagePath)
        .catch(log.error)
      if (content) {
        st = `url(data:image;base64,${content})`
      }
    } else if (this.props.terminalBackgroundImagePath && isWebImg) {
      st = `url(${this.props.terminalBackgroundImagePath})`
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