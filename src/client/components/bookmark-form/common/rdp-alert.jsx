import { Alert } from 'antd'
import { rdpWikiLink } from '../../../common/constants'
import Link from '../../common/external-link'

export default function RdpAlert () {
  return (
    <Alert
      message={<Link to={rdpWikiLink}>WIKI: {rdpWikiLink}</Link>}
      type='warning'
      className='mg2y'
    />
  )
}
