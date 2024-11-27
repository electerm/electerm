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
      width: width + 'px',
      height: (height - 30) + 'px'
    },
    disableblinkfeatures: 'true',
    disablewebsecurity: 'true'
  }
  return (
    <div className='web-session-wrap'>
      <AddressBar {...addrProps} />
      <webview
        {...viewProps}
      />
    </div>
  )
}
