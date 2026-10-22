/**
 * Custom widget UI panel.
 *
 * A user widget that ships `electerm.ui` (see widgets/user-widget.js) gets its
 * own document instead of the generated config form. It is served from
 * electerm-widget://<id>/... — a different origin from the app — and talks to
 * the host only through window.electerm, which the protocol injects into the
 * page (widgets/bridge.js). Everything here is the host half of that
 * conversation: answer the calls, hand over the theme.
 */
import React, { useEffect, useRef, useState } from 'react'
import { Button, Tooltip } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { copy } from '../../common/clipboard'
import { safeGetItemJSON, safeSetItemJSON } from '../../common/safe-local-storage'
import isColorDark from '../../common/is-color-dark'
import openWidgetTab from './widget-open-tab'

const e = window.translate

// A widget's own key/value store, the same one config-mode widgets persist to.
// Reading it through getConfig is deliberately scoped: handing the whole app
// config to a widget page would expose every setting the app has, and letting
// updateConfig write it would let a widget change them.
function widgetConfigKey (widgetId) {
  return `widget-config-${widgetId}`
}

function readWidgetConfig (widgetId) {
  const stored = safeGetItemJSON(widgetConfigKey(widgetId), {})
  return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
}

// forwarded to the widget as CSS variables on :root, so a widget panel can look
// like the rest of the app without linking the app's stylesheet
const THEME_VARS = [
  '--main',
  '--main-dark',
  '--main-darker',
  '--main-light',
  '--main-lighter',
  '--text',
  '--text-light',
  '--text-dark',
  '--text-disabled',
  '--primary',
  '--primary-contrast',
  '--info',
  '--success',
  '--error',
  '--warn'
]

function themePayload () {
  const styles = window.getComputedStyle(document.body)
  const cssVars = {}
  THEME_VARS.forEach(name => {
    const value = styles.getPropertyValue(name).trim()
    if (value) {
      cssVars[name] = value
    }
  })
  return {
    cssVars,
    colorScheme: isColorDark(cssVars['--main']) ? 'dark' : 'light'
  }
}

async function handleCall (widgetId, method, args) {
  switch (method) {
    case 'call': {
      const [name, ...rest] = args
      if (typeof name !== 'string' || !name) {
        throw new Error('call needs a function name')
      }
      return window.pre.runGlobalAsync('callWidgetFunc', widgetId, name, ...rest)
    }
    case 'getConfig':
      return readWidgetConfig(widgetId)
    case 'updateConfig': {
      const patch = args[0]
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        throw new Error('updateConfig needs an object')
      }
      const next = { ...readWidgetConfig(widgetId), ...patch }
      safeSetItemJSON(widgetConfigKey(widgetId), next)
      return next
    }
    case 'openDialog':
      return window.api.openDialog(args[0] || {})
    case 'saveDialog':
      return window.api.saveDialog(args[0] || {})
    case 'copy':
      return copy(String(args[0] == null ? '' : args[0]))
    case 'openExternal':
      return window.pre.openExternal(args[0])
    case 'openTab':
      return openWidgetTab(widgetId, args[0])
    case 'log':
      console.log(`[widget:${widgetId}]`, ...args)
      return null
    default:
      throw new Error(`unknown widget host method: ${method}`)
  }
}

export default function CustomWidgetPanel ({ widget }) {
  const { id, info } = widget
  const frameRef = useRef(null)
  const [nonce, setNonce] = useState(0)
  const ui = String(info.ui || '').replace(/^\/+/, '')
  const src = `electerm-widget://${id}/${ui}${nonce ? `?r=${nonce}` : ''}`

  useEffect(() => {
    function onMessage (evt) {
      const frame = frameRef.current
      // the widget is its own origin: only answer its own frame, never a
      // random page that happens to post the same shape
      if (!frame || evt.source !== frame.contentWindow) {
        return
      }
      const data = evt.data
      if (!data || data.__electermWidget !== true) {
        return
      }
      const reply = (payload) => {
        if (!frame.contentWindow) {
          return
        }
        frame.contentWindow.postMessage({
          __electermWidgetHost: true,
          reqId: data.reqId,
          ...payload
        }, '*')
      }
      handleCall(id, data.method, data.args || [])
        .then(result => reply({ ok: true, result }))
        .catch(err => reply({
          ok: false,
          error: err && err.message ? err.message : String(err)
        }))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [id])

  // init arrives after the bridge is parsed, which is after load for every
  // script in the document
  const sendInit = () => {
    const frame = frameRef.current
    if (!frame || !frame.contentWindow) {
      return
    }
    frame.contentWindow.postMessage({
      __electermWidgetHost: true,
      method: 'init',
      data: {
        id,
        name: info.name,
        version: info.version,
        ...themePayload()
      }
    }, '*')
  }

  return (
    <div className='custom-widget-panel'>
      <div className='cwp-head'>
        <div className='cwp-title elli' title={info.description || info.name}>
          {info.name}
          <span className='cwp-version'>{info.version}</span>
        </div>
        <Tooltip title={e('reload')}>
          <Button
            size='small'
            type='text'
            icon={<ReloadOutlined />}
            onClick={() => setNonce(Date.now())}
          />
        </Tooltip>
      </div>
      <iframe
        key={nonce}
        ref={frameRef}
        className='cwp-frame'
        title={info.name}
        src={src}
        onLoad={sendInit}
        sandbox='allow-scripts allow-same-origin allow-forms allow-modals allow-popups'
      />
    </div>
  )
}
