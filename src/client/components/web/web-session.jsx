import AddressBar from './address-bar'
import WebAuthModal from './web-auth-modal'
import React, { useState, useRef, useEffect, useCallback } from 'react'

export default function WebSession (props) {
  const {
    tab,
    width,
    height,
    reloadTab
  } = props
  const [zoom, setZoom] = useState(1.0)
  const [authRequest, setAuthRequest] = useState(null)
  const webviewRef = useRef(null)
  const urlRegex = /^[a-z\d.+-]+:\/\/[^\s/$.?#].[^\s]*$/i

  const { url = '' } = tab
  const addrProps = {
    url,
    title: tab.title,
    description: tab.description,
    zoom,
    onZoom: handleZoom,
    onOpen: () => {
      window.openLink(tab.url)
    },
    onReload: () => {
      reloadTab(
        tab
      )
    }
  }

  function handleZoom (v) {
    setZoom(v)
    const el = webviewRef.current
    if (!el) {
      return
    }
    if (el.setZoomFactor) {
      el.setZoomFactor(v)
    } else {
      el.style.zoom = v
    }
  }

  // Handle HTTP Basic Auth requests from webview
  useEffect(() => {
    if (!window.api || !window.api.onWebviewAuthRequest) {
      return
    }
    const removeListener = window.api.onWebviewAuthRequest((data) => {
      setAuthRequest(data)
    })
    return removeListener
  }, [])

  const handleAuthSubmit = useCallback((username, password) => {
    if (!authRequest) return
    window.api.sendWebviewAuthResponse({
      id: authRequest.id,
      username,
      password
    })
    setAuthRequest(null)
  }, [authRequest])

  const handleAuthCancel = useCallback(() => {
    if (!authRequest) return
    window.api.sendWebviewAuthResponse({
      id: authRequest.id,
      username: '',
      password: ''
    })
    setAuthRequest(null)
  }, [authRequest])

  // TODO: 支持自定义Header和Cookie
  // useEffect(() => {
  //   const webview = document.querySelector('webview')
  //   if (webview) {
  //     // 添加事件监听，输出所有的事件
  //     webview.addEventListener('did-start-loading', (e) => {
  //       console.log('did-start-loading', e)
  //     })
  //   }
  // }, []);

  // 打开webview的开发者工具
  // useEffect(() => {
  //   const webview = document.querySelector('webview')
  //   if (webview) {
  //     webview.addEventListener('dom-ready', () => {
  //       webview.openDevTools()
  //     })
  //   }
  // }, [])

  function renderView () {
    if (!urlRegex.test(tab.url)) {
      return (
        <div>
          URL: <b>{url}</b> not valid
        </div>
      )
    }
    const hOffset = tab.hideAddressBar ? 30 : -12
    if (window.et.isWebApp) {
      const iframeProps = {
        src: url,
        style: {
          width: (width - 10) + 'px',
          height: (height + hOffset) + 'px'
        }
      }
      return (
        <iframe {...iframeProps} ref={webviewRef} />
      )
    }
    const viewProps = {
      src: url,
      style: {
        width: (width - 10) + 'px',
        height: (height + hOffset) + 'px'
      },
      disableblinkfeatures: 'true',
      disablewebsecurity: 'true',
      allowpopups: 'true',
      useragent: tab.useragent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    }
    return (
      <webview {...viewProps} ref={webviewRef} />
    )
  }

  return (
    <div className='web-session-wrap'>
      {!tab.hideAddressBar && (
        <AddressBar {...addrProps} />
      )}
      <div className='pd1'>
        {renderView()}
      </div>
      <WebAuthModal
        authRequest={authRequest}
        onAuthSubmit={handleAuthSubmit}
        onAuthCancel={handleAuthCancel}
      />
    </div>
  )
}
