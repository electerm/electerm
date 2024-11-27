import { useEffect } from 'react'
import Link from '../common/external-link'

export default function WebSession (props) {
  const {
    tab
  } = props
  useEffect(() => {
    if (!tab.enableShowInSession) {
      tab.url && window.openLink(tab.url)
    }
  }, [])
  return (
    <div className='web-session-wrap'>
      {tab.enableShowInSession
        ? (
          <webview
          // disablewebsecurity={tab.disableWebSecurity}
            disablewebsecurity='true'
            disableblinkfeatures='true'
            src={tab.url}
            style={{ width: '100%', height: '100%' }}
          />
          )
        : (
          <div className='pd3 aligncenter'>
            <h1>{tab.title}</h1>
            <p>{tab.description}</p>
            <Link to={tab.url}>{tab.url}</Link>
          </div>
          )}
    </div>
  )
}

// export default function WebSession (props) {
//   const {
//     tab
//   } = props
//
//   useEffect(() => {
//
//   }, [])
//
//   return (
//     <div className='web-session-wrap'>
//       <webview
//         disablewebsecurity='true'
//         disableblinkfeatures='true'
//         src={tab.url}
//         style={{ width: '100%', height: '100%' }}
//       />
//     </div>
//   )
// }
