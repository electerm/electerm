/**
* btns
*/
import { useEffect, useRef } from 'react'
import { noTerminalBgValue, textTerminalBgValue } from '../../common/constants'
import { generateMosaicBackground } from './shapes'

const themeDomId = 'css-overwrite-terminal-backgrounds'

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
  } else if (st !== 'none') {
    styles.push(
      `background-image: ${st}`,
      'background-position: center',
      `filter: ${createFilterStyle(props, tab)}`
    )
  }
  return `${selector} {
    ${styles.join(';')};
  }`
}

// Pre-rendered rainbow-filled version of the watermark letterforms (same
// shape as electerm-watermark.png, opaque, hue sweeping left-to-right
// across the word). Generated once from that PNG's alpha shape - a plain
// hue-rotate filter can't recolor the real watermark live because it's
// already flat gray (hue-rotate has no effect on desaturated pixels), and
// masking a live gradient through the low-alpha original at runtime was
// visibly broken on software rendering, so this bakes the color in as a
// static asset instead. Inlined so no build-pipeline asset wiring is needed.
const watermarkRainbowDataUri = 'data:image/png;base64,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'

function watermarkIntroStyle () {
  return `
@keyframes electerm-watermark-intro {
  0% { opacity: 1; filter: hue-rotate(0deg) saturate(1.3); }
  70% { opacity: 1; filter: hue-rotate(140deg) saturate(1.3); }
  100% { opacity: 0; filter: hue-rotate(200deg) saturate(1.3); }
}
#container .session-batch-active .xterm-screen::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-repeat: no-repeat;
  background-position: center;
  background-image: url("${watermarkRainbowDataUri}");
  animation: electerm-watermark-intro 2.6s ease-out forwards;
  pointer-events: none;
}
`
}

async function createGlobalStyle (props) {
  const st = await createBackgroundStyle(props.terminalBackgroundImagePath)
  if (!st) {
    return '#container .session-batch-active .xterm-screen::before {' +
    'background-image: url("./images/electerm-watermark.png");' +
    '}' + watermarkIntroStyle()
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
