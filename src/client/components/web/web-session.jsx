import AddressBar from './address-bar'
// import React, { useEffect } from 'react'

export default function WebSession (props) {
  const {
    tab,
    width,
    height,
    reloadTab
  } = props
  const urlRegex = /^[a-z\d.+-]+:\/\/[^\s/$.?#].[^\s]*$/i

  const { url = '' } = tab
  const addrProps = {
    url,
    title: tab.title,
    description: tab.description,
    onOpen: () => {
      window.openLink(tab.url)
    },
    onReload: () => {
      reloadTab(
        tab
      )
    }
  }

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
        <iframe {...iframeProps} />
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
      <webview {...viewProps} />
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
    </div>
  )
}
