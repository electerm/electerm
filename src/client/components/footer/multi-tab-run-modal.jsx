/**
 * Run one command (usually picked from the command history) in several
 * terminals at once.
 *
 * Reuses the footer batch input tab panel (`TabSelectList`) for picking the
 * target terminals, and the same selection state + `batchInput` terminal API
 * the footer batch input uses, so both entry points stay consistent.
 *
 * Pass `onRun(tabIds)`, `preview` and `title` to run something other than a single
 * command line, such as a quick command.
 */

import { auto } from 'manate/react'
import {
  Button,
  Modal
} from 'antd'
import { TabSelectList } from './tab-select'
import { refs } from '../common/ref'
import {
  terminalWebType,
  terminalRdpType,
  terminalVncType
} from '../../common/constants'

const e = window.translate

export default auto(function MultiTabRunModal (props) {
  const { store, cmd, onClose, onRun, preview, title } = props
  const selectedTabIds = store.batchInputSelectedTabIds
  const tabs = store.tabs.filter(tab => {
    return tab.type !== terminalWebType &&
      tab.type !== terminalRdpType &&
      tab.type !== terminalVncType
  }).sort((a, b) => {
    // current tab goes first
    if (a.id === store.activeTabId) return -1
    if (b.id === store.activeTabId) return 1
    return 0
  })
  const listProps = {
    tabs,
    activeTabId: store.activeTabId,
    selectedTabIds,
    onSelect: store.onSelectBatchInputSelectedTabId,
    onSelectAll: store.selectAllBatchInputTabs,
    onSelectNone: store.selectNoneBatchInputTabs
  }
  function handleRun () {
    if (onRun) {
      // only the terminals listed here, never a web or remote desktop tab
      onRun(selectedTabIds.filter(id => tabs.some(t => t.id === id)))
      onClose()
      return
    }
    selectedTabIds.map(id => {
      return refs.get('term-' + id)
    }).forEach(term => {
      term?.batchInput(cmd)
    })
    store.addCmdHistory(cmd)
    onClose()
  }
  return (
    <Modal
      open
      title={title || e('runInAllTerminals')}
      onCancel={onClose}
      destroyOnHidden
      width={520}
      footer={[
        <Button
          key='cancel'
          onClick={onClose}
        >
          {e('cancel')}
        </Button>,
        <Button
          key='run'
          type='primary'
          disabled={!selectedTabIds.length}
          onClick={handleRun}
        >
          {e('ok')}
        </Button>
      ]}
    >
      <div className='multi-tab-run-cmd'>{preview || cmd}</div>
      <TabSelectList {...listProps} />
    </Modal>
  )
})
