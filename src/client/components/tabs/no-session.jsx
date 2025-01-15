import { Button } from 'antd'
import LogoElem from '../common/logo-elem.jsx'
import HistoryPanel from '../sidebar/history'

const e = window.translate

export default function NoSessionPanel ({ height, onNewTab, onNewSsh, batch }) {
  const props = {
    style: {
      height: height + 'px'
    }
  }
  const handleClick = () => {
    window.openTabBatch = batch
  }
  return (
    <div className='no-sessions electerm-logo-bg' {...props}>
      <Button
        onClick={onNewTab}
        size='large'
        className='mg1r mg1b add-new-tab-btn'
      >
        {e('newTab')}
      </Button>
      <Button
        onClick={onNewSsh}
        size='large'
        className='mg1r mg1b'
      >
        {e('newBookmark')}
      </Button>
      <div className='pd3'>
        <LogoElem />
      </div>
      <div className='no-session-history' onClick={handleClick}>
        <HistoryPanel sort />
      </div>
    </div>
  )
}
