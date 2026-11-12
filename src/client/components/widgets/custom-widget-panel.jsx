/**
 * Custom widget UI panel.
 *
 * A user widget that ships `electerm.ui` (see widgets/user-widget.js) gets its
 * own document instead of the generated config form. The desktop app serves it
 * from electerm-widget://<id>/..., the web app from /api/widget-ui/<id>/... —
 * either way it ends up on an origin of its own, and talks to the host only
 * through window.electerm, which the host injects into the page
 * (widgets/bridge.js). Everything here is the host half of that conversation:
 * answer the calls, hand over the theme.
 */
import React, { useEffect, useRef, useState } from 'react'
import { Button, Tooltip } from 'antd'
import { PlayCircleOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons'
import { auto } from 'manate/react'
import { copy } from '../../common/clipboard'
import { safeGetItemJSON, safeSetItemJSON } from '../../common/safe-local-storage'
import { widgetConfigKey } from '../../common/widget-form-memory-utils'
import isColorDark from '../../common/is-color-dark'
import { webUrl } from '../../common/web-url'
import openWidgetTab from './widget-open-tab'
import WidgetAIConfig from './widget-ai-config'

const e = window.translate

// Reopening the settings panel remounts this component. An explicit Stop must
// survive that until the next app launch, when "Start with electerm" applies.
const stoppedByUser = new Set()

// A widget's own key/value store, the same one config-mode widgets persist to
// (widgetConfigKey). Reading it through getConfig is deliberately scoped:
// handing the whole app config to a widget page would expose every setting the
// app has, and letting updateConfig write it would let a widget change them.
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

async function handleCall (widgetId, method, args, onOffer, defaultAutoRun) {
  switch (method) {
    case 'call': {
      const [name, ...rest] = args
      if (typeof name !== 'string' || !name) {
        throw new Error('call needs a function name')
      }
      const result = await window.pre.runGlobalAsync('callWidgetFunc', widgetId, name, ...rest)
      // The main process already whitelisted this offer (load-widget.js).
      // Rendering it in the host panel instead of the iframe keeps "point
      // electerm at this endpoint" a deliberate click on a host-owned button.
      if (result && result.aiConfig && onOffer) {
        onOffer(result.aiConfig)
      }
      return result
    }
    case 'getConfig': {
      const conf = readWidgetConfig(widgetId)
      // Untouched widgets follow the manifest's autoRun default. Once the user
      // picks a value it is stored here and in autoRunWidgets together.
      return {
        ...conf,
        autoRun: typeof conf.autoRun === 'boolean' ? conf.autoRun : !!defaultAutoRun
      }
    }
    case 'updateConfig': {
      const patch = args[0]
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        throw new Error('updateConfig needs an object')
      }
      const next = { ...readWidgetConfig(widgetId), ...patch }
      safeSetItemJSON(widgetConfigKey(widgetId), next)
      if (typeof patch.autoRun === 'boolean') {
        window.store.setWidgetAutoRun(widgetId, patch.autoRun, next)
      }
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

export default auto(function CustomWidgetPanel ({ widget }) {
  const { id, info } = widget
  const frameRef = useRef(null)
  const [nonce, setNonce] = useState(0)
  const [offer, setOffer] = useState(null)
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  // auto() re-renders on store mutations: the same instance list the widgets
  // sidebar shows is the source of truth for the Run/Stop state.
  const running = window.store.widgetInstances.find(i => i.widgetId === id)
  const ui = String(info.ui || '').replace(/^\/+/, '')
  // A browser has no privileged custom scheme, so the web app serves the same
  // folder over http (see src/app/routes/widget-ui.js there), under an optional
  // sub-path — hence webUrl. The nonce is a cache buster in both cases: a
  // reinstall replaces files in place.
  const uiBase = window.et.isWebApp
    ? webUrl(`/api/widget-ui/${id}`)
    : `electerm-widget://${id}`
  const src = `${uiBase}/${ui}${nonce ? `?r=${nonce}` : ''}`

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
      handleCall(id, data.method, data.args || [], setOffer, !!info.autoRun)
        .then(result => reply({ ok: true, result }))
        .catch(err => reply({
          ok: false,
          error: err && err.message ? err.message : String(err)
        }))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [id])

  // An instance widget that ships its own UI has no generated run form, so the
  // panel owns starting it. The same path serves the explicit Run button and
  // the manifest's `electerm.autoRun`; a failed start is shown here instead of
  // only in the console, where the widget later fails with "not running".
  async function run () {
    if (working) {
      return
    }
    stoppedByUser.delete(id)
    setWorking(true)
    setError('')
    try {
      const config = readWidgetConfig(id)
      const result = await window.store.runWidget(id, config)
      if (!result || !result.instanceId) {
        return
      }
      const instance = {
        id: result.instanceId,
        title: `${info.name} (${result.instanceId})`,
        widgetId: id,
        serverInfo: result.serverInfo,
        aiConfig: result.aiConfig || null,
        config: { ...config },
        startedAt: Date.now()
      }
      window.store.widgetInstances = [
        ...window.store.widgetInstances.filter(w => w.id !== instance.id),
        instance
      ]
      if (result.aiConfig) {
        setOffer(result.aiConfig)
      }
      // Register for launch only when the user's switch is on. A widget that
      // never declared autoRun has no switch, so it keeps the old behaviour.
      if (info.autoRun) {
        window.store.setWidgetAutoRun(id, config.autoRun !== false, config)
      }
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setWorking(false)
    }
  }

  async function stop () {
    if (!running) {
      return
    }
    setWorking(true)
    setError('')
    stoppedByUser.add(id)
    try {
      await window.store.stopWidget(running.id)
      // main process may have lost the instance already (crash, re-import):
      // drop the stale renderer entry so Run becomes available again
      if (window.store.widgetInstances.some(w => w.id === running.id)) {
        window.store.deleteWidgetInstance(running.id)
      }
      setOffer(null)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setWorking(false)
    }
  }

  useEffect(() => {
    // "Start with electerm" is the user's switch, not a manifest decision:
    // turning it off means the panel no longer starts the widget on its own.
    const autoRun = info.autoRun && readWidgetConfig(id).autoRun !== false
    if (info.type !== 'instance' || !autoRun || running || stoppedByUser.has(id)) {
      return
    }
    run()
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
        <div className='cwp-actions'>
          {info.type === 'instance'
            ? (
              <>
                {/* The dot carries the state; the button carries the action.
                    Stopped is the state a user has to notice, so Run is the
                    only filled control in the panel. */}
                <span className={'cwp-state' + (running ? ' is-on' : '')}>
                  {running ? 'Running' : 'Stopped'}
                </span>
                <Button
                  size='small'
                  type={running ? 'default' : 'primary'}
                  danger={running}
                  icon={running ? <StopOutlined /> : <PlayCircleOutlined />}
                  loading={working}
                  onClick={running ? stop : run}
                >
                  {running ? 'Stop' : 'Run'}
                </Button>
              </>
              )
            : null}
          <Tooltip title={e('reload')}>
            <Button
              size='small'
              type='text'
              icon={<ReloadOutlined />}
              onClick={() => setNonce(Date.now())}
            />
          </Tooltip>
        </div>
      </div>
      {error
        ? <div className='cwp-error'>{running ? 'Stop failed' : 'Run failed'}: {error}</div>
        : null}
      {offer
        ? (
          <div className='cwp-offer'>
            <WidgetAIConfig aiConfig={offer} store={window.store} />
          </div>
          )
        : null}
      {/*
        Over http the widget document would otherwise share the app's origin,
        and with it window.store and the token in localStorage. Withholding
        allow-same-origin gives it an opaque origin instead, which is what the
        custom scheme provides on the desktop; the server sends the same
        restrictions as a CSP header (belt and braces, and it holds even in a
        client that forgot the attribute).
      */}
      <iframe
        key={nonce}
        ref={frameRef}
        className='cwp-frame'
        title={info.name}
        src={src}
        onLoad={sendInit}
        sandbox={window.et.isWebApp
          ? 'allow-scripts allow-forms allow-modals allow-popups'
          : 'allow-scripts allow-same-origin allow-forms allow-modals allow-popups'}
      />
    </div>
  )
})
