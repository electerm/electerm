import {
  Popover
} from 'antd'
import TabItem from './batch-item'
import {
  CodeOutlined
} from '@ant-design/icons'

/**
 * The multi terminal selection panel: select-all/none plus one toggle button
 * per terminal tab.
 * Extracted so it can be reused outside the batch input popover (e.g. run a
 * command from the history panel in several terminals at once).
 */
export function TabSelectList (props) {
  const {
    selectedTabIds = [],
    tabs = [],
    activeTabId,
    onSelect,
    onSelectAll,
    onSelectNone
  } = props
  function renderTabs () {
    return tabs.map(tab => {
      const selected = selectedTabIds.includes(tab.id)
      const itemProps = {
        tab,
        selected,
        onSelect,
        id: tab.id,
        isCurrent: tab.id === activeTabId
      }
      return (
        <TabItem
          key={tab.id}
          {...itemProps}
        />
      )
    })
  }
  function renderBtns () {
    return (
      <div className='pd1t pd2b font12'>
        <span
          className='mg1r pointer'
          onClick={onSelectAll}
        >
          All
        </span>
        <span
          className='pointer'
          onClick={onSelectNone}
        >
          None
        </span>
      </div>
    )
  }
  return (
    <div className='pd1x alignright'>
      {renderBtns()}
      {renderTabs()}
    </div>
  )
}

export default function TabSelect (props) {
  const { selectedTabIds, tabs, activeTabId } = props
  const listProps = {
    selectedTabIds,
    tabs,
    activeTabId,
    onSelect: window.store.onSelectBatchInputSelectedTabId,
    onSelectAll: window.store.selectAllBatchInputTabs,
    onSelectNone: window.store.selectNoneBatchInputTabs
  }
  return (
    <Popover
      content={<TabSelectList {...listProps} />}
      trigger='click'
    >
      <span className='pointer iblock pd1x'>
        ({selectedTabIds.length}) <CodeOutlined />
      </span>
    </Popover>
  )
}
