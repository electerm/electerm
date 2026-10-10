/**
 * footer chip while a tab is being recorded into a quick command, with save
 * and cancel, and the form that saves the recording
 */
import { auto } from 'manate/react'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import QuickCommandCreateModal from './quick-command-create-modal'
import translateOr from '../../common/translate-fallback'
import createName from '../../common/create-title'
import deepCopy from 'json-deep-copy'
import './qm.styl'

const e = window.translate

export default auto(function QmRecordStatus ({ store }) {
  const rec = store.qmRecording
  const steps = store.qmRecordedSteps
  if (steps) {
    return (
      <QuickCommandCreateModal
        store={store}
        commands={deepCopy(steps)}
        name={translateOr('recordedQuickCommand', 'Recorded quick command')}
        labels={['recorded']}
        isRecorded
        onClose={() => { window.store.qmRecordedSteps = null }}
      />
    )
  }
  if (!rec) {
    return null
  }
  // name the tab when the recording isn't in the one on screen
  const tab = rec.tabId !== store.activeTabId
    ? store.tabs.find(t => t.id === rec.tabId)
    : null
  const label = translateOr('recording', 'Recording')
  return (
    <div className='terminal-footer-unit terminal-footer-qm-run'>
      <span className='qm-run-chip qm-rec-chip'>
        <span className='qm-run-info'>
          <span className='qm-rec-dot mg1r' />
          <span className='elli qm-run-name'>
            {tab ? `${label}: ${createName(tab)}` : label}
          </span>
          <span className='mg1l'>{rec.count} {translateOr('steps', 'Steps').toLowerCase()}</span>
        </span>
        <span
          className='pointer qm-rec-save'
          title={translateOr('saveRecording', 'Stop recording and save')}
          onClick={() => store.stopQuickCommandRecording(true)}
        >
          <CheckOutlined className='mg1r' />
          {e('save')}
        </span>
        <span
          className='pointer qm-rec-cancel'
          title={translateOr('cancelRecording', 'Stop recording and discard it')}
          onClick={() => store.stopQuickCommandRecording(false)}
        >
          <CloseOutlined />
        </span>
      </span>
    </div>
  )
})
