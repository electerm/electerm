/**
* btns
*/
import { useEffect, useRef } from 'react'
import { noTerminalBgValue, textTerminalBgValue } from '../../common/constants'
import { generateMosaicBackground } from './shapes'

const themeDomId = 'css-overwrite-terminal-backgrounds'

// natural (intrinsic) width of images/electerm-watermark.png, used to keep the
// default terminal background at its original size on wide terminals
const watermarkWidth = 766

function createBackgroundStyle (imagePath) {
  if (!imagePath || imagePath === '') {
    return ''
  }

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
    return window.fs.readFileAsBase64(imagePath)
      .then(content => {
        if (content) {
          return `url(data:image;base64,${content})`
        }
        return ''
      })
      .catch(() => '')
  } else if (imagePath && isWebImg) {
    st = `url(${imagePath})`
  }
  return st
}

function createFilterStyle (props, tabProps = null) {
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

async function createStyleForTab (tab, props) {
  const bg = tab.terminalBackground || {}
  const img = bg.terminalBackgroundImagePath || props.terminalBackgroundImagePath
  const st = await createBackgroundStyle(img)

  if (!st) {
    return ''
  }

  const selector = `#container .sessions .session-${tab.id} .xterm-screen::before`
  const styles = []
  if (st === 'index') {
    styles.push(
      `content: '${tab.tabCount}'`,
      'background-image: none',
      'opacity: 0.1'
    )
  } else if (st === 'text') {
    const text = bg.terminalBackgroundText || props.terminalBackgroundText || ''
    const size = bg.terminalBackgroundTextSize || props.terminalBackgroundTextSize || 48
    const color = bg.terminalBackgroundTextColor || props.terminalBackgroundTextColor || '#ffffff'
    const fontFamily = bg.terminalBackgroundTextFontFamily || props.terminalBackgroundTextFontFamily || 'monospace'
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
        'background-image: none'
      )
    }
  } else if (st === 'none') {
    // The [🚫] opt-out must be spelled out: this rule has a higher specificity
    // than the global one, but an empty declaration block would still let the
    // built-in default bg painted by createGlobalStyle show through.
    styles.push('background-image: none')
  } else {
    styles.push(
      `background-image: ${st}`,
      'background-position: center',
      // createGlobalStyle's built-in default bg rule carries an auto-fit
      // `background-size` (so the 766px wide watermark is not cropped on
      // narrow panes), and for the active tab it targets this very same
      // ::before. `background-size` is not reset by a rule that only sets
      // `background-image`, so it would leak onto the user's image and scale
      // it down to at most 766px, centred — a big image that used to fill the
      // pane would no longer cover it. Stating the initial value keeps user
      // images at their natural size, which is what they rendered at before
      // the auto-fit was introduced.
      'background-size: auto',
      `filter: ${createFilterStyle(props, tab)}`
    )
  }
  return `${selector} {
    ${styles.join(';')};
  }`
}

async function createGlobalStyle (props) {
  const st = await createBackgroundStyle(props.terminalBackgroundImagePath)
  if (!st) {
    // Default terminal bg = the electerm watermark (766 x 266 natural size).
    // Without an explicit size the image is just centered at 1:1, so on narrow
    // panes (mobile / thin split columns) it gets cropped on both sides.
    // `min(100%, 766px) auto` keeps the aspect ratio and scales it down to fit
    // the pane width, while leaving the desktop rendering (= natural size)
    // untouched.
    return '#container .session-batch-active .xterm-screen::before {' +
    'background-image: url("./images/electerm-watermark.png");' +
    `background-size: min(100%, ${watermarkWidth}px) auto;` +
    '}'
  }

  const styles = []

  if (st === 'text') {
    const text = props.terminalBackgroundText || ''
    const size = props.terminalBackgroundTextSize || 48
    const color = props.terminalBackgroundTextColor || '#ffffff'
    const fontFamily = props.terminalBackgroundTextFontFamily || 'monospace'
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
        'background-image: none'
      )
    }
  } else if (st !== 'none' && st !== 'index') {
    styles.push(
      `background-image: ${st}`,
      'background-position: center',
      `filter: ${createFilterStyle(props)}`
    )
  }

  return `#container .session-batch-active .xterm-screen::before {
    ${styles.join(';')};
  }`
}

async function writeCss (props, styleTag) {
  const { tabs = [] } = props
  const tabStyles = await Promise.all(
    tabs
      .map(tab => createStyleForTab(tab, props))
  )
  const globalStyle = await createGlobalStyle(props)
  const allStyles = [
    globalStyle,
    ...tabStyles
  ].filter(Boolean).join('\n')
  styleTag.innerHTML = allStyles
}

export default function CssOverwrite (props) {
  const { configLoaded } = props
  const styleTagRef = useRef(null)

  useEffect(() => {
    if (!configLoaded) {
      return
    }

    if (!styleTagRef.current) {
      styleTagRef.current = document.createElement('style')
      styleTagRef.current.type = 'text/css'
      styleTagRef.current.id = themeDomId
      document.getElementsByTagName('head')[0].appendChild(styleTagRef.current)
    }

    const timeoutId = setTimeout(() => {
      writeCss(props, styleTagRef.current)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [
    configLoaded,
    props.terminalBackgroundImagePath,
    props.terminalBackgroundFilterBlur,
    props.terminalBackgroundFilterOpacity,
    props.terminalBackgroundFilterBrightness,
    props.terminalBackgroundFilterContrast,
    props.terminalBackgroundFilterGrayscale,
    props.terminalBackgroundText,
    props.terminalBackgroundTextSize,
    props.terminalBackgroundTextColor,
    props.terminalBackgroundTextFontFamily,
    props.tabs
  ])

  return null
}
