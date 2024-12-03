import AddressBar from './address-bar'
// import React, { useEffect } from 'react'

export default function WebSession (props) {
  const {
    tab,
    width,
    height,
    reloadTab
  } = props
  const addrProps = {
    url: tab.url,
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

  const viewProps = {
    src: tab.url,
    style: {
      width: (width - 10) + 'px',
      height: (height - 12) + 'px'
    },
    disableblinkfeatures: 'true',
    disablewebsecurity: 'true',
    allowpopups: 'true'

  }
  return (
    <div className='web-session-wrap'>
      <AddressBar {...addrProps} />
      <div className='pd1'>
        <webview
          {...viewProps}
        />
      </div>
    </div>
  )
}
