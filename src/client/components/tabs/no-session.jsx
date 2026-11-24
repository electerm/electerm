import { Button } from 'antd'
import HistoryPanel from '../sidebar/history'
import QuickConnect from './quick-connect'
import './no-session.styl'

const e = window.translate

export default function NoSessionPanel ({ batch }) {
  const handleClick = () => {
    window.openTabBatch = batch
  }

  const onNewSsh = () => {
    handleClick()
    window.store.onNewSsh()
  }

  const newTabDom = window.store.hasNodePty
    ? (
      <Button
        onClick={() => window.store.addTab(undefined, undefined, batch)}
        className='add-new-tab-btn'
      >
        {e('newTab')}
      </Button>
      )
    : null
  return (
    <div className='no-sessions'>
      <div className='no-session-btns'>
        {newTabDom}
        <Button
          onClick={onNewSsh}
        >
          {e('newBookmark')}
        </Button>
        <QuickConnect batch={batch} />
      </div>
      <div className='no-session-history' onClick={handleClick}>
        <HistoryPanel sort />
      </div>
    </div>
  )
}
