import {
  Button
} from 'antd'
import Link from './external-link'
import {
  connectionHoppingWikiLink,
  connectionHoppingWarnKey
} from '../../common/constants'
import * as ls from '../../common/safe-local-storage'

const e = window.translate

export default function ConnectionHoppingWarningText (props) {
  function handleRead () {
    ls.setItem(connectionHoppingWarnKey, 'yes')
    props.closeWarn()
  }
  return (
    <div className='pd1'>
      <div className='pd1b'>
        <span>{e('connectionHoppingWarning')}</span>
      </div>
      <div className='pd1b'>
        <Link to={connectionHoppingWikiLink}>{connectionHoppingWikiLink}</Link>
      </div>
      <div className='pd1b'>
        <Button
          onClick={handleRead}
          size='small'
        >
          {e('haveRead')}
        </Button>
      </div>
    </div>
  )
}
