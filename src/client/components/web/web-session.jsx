import AddressBar from './address-bar'

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
  const viewProps = {
    src: tab.url,
    style: {
      width: (width - 10) + 'px',
      height: (height - 12) + 'px'
    },
    disableblinkfeatures: 'true',
    disablewebsecurity: 'true'
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
