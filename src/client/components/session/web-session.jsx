import { useEffect } from 'react'
import Link from '../common/external-link'

export default function WebSession (props) {
  const {
    tab
  } = props
  useEffect(() => {
    tab.url && window.openLink(tab.url)
  }, [])
  return (
    <div className='web-session-wrap'>
      <div className='pd3 aligncenter'>
        <h1>{tab.title}</h1>
        <p>{tab.description}</p>
        <Link to={tab.url}>{tab.url}</Link>
      </div>
    </div>
  )
}
