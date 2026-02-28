import { Button } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import LogoElem from '../common/logo-elem.jsx'
import HistoryPanel from '../sidebar/history'
import QuickConnect from './quick-connect'
import './no-session.styl'

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

  const handleCreateAIBookmark = () => {
    window.store.onNewSshAI()
  }

  const newTabDom = window.store.hasNodePty
    ? (
      <Button
        onClick={onNewTab}
        className='mg1r mg1b add-new-tab-btn'
      >
        {e('newTab')}
      </Button>
      )
    : null
  return (
    <div className='no-sessions electerm-logo-bg' {...props}>
      <div className='pd1b'>
        {newTabDom}
        <Button
          onClick={onNewSsh}
          className='mg1r mg1b'
        >
          {e('newBookmark')}
        </Button>
        <Button
          onClick={handleCreateAIBookmark}
          className='mg1r mg1b'
          icon={<RobotOutlined />}
        >
          {e('createBookmarkByAI')}
        </Button>
        <QuickConnect batch={batch} />
      </div>
      <div className='pd3'>
        <LogoElem />
      </div>
      <div className='no-session-history' onClick={handleClick}>
        <HistoryPanel sort />
      </div>
    </div>
  )
}
