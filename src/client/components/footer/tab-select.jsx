import {
  Popover
} from 'antd'
import TabItem from './batch-item'
import {
  CodeOutlined
} from '@ant-design/icons'

export default function TabSelect (props) {
  const { selectedTabIds, tabs, activeTabId } = props
  function renderTabs () {
    return tabs.map(tab => {
      const selected = selectedTabIds.includes(tab.id)
      const itemProps = {
        tab,
        selected,
        onSelect: window.store.onSelectBatchInputSelectedTabId,
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
  function onSelectAll () {
    window.store.selectAllBatchInputTabs()
  }
  function onSelectNone () {
    window.store.selectNoneBatchInputTabs()
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
  function renderContent () {
    return (
      <div className='pd1x'>
        {renderBtns()}
        {renderTabs()}
      </div>
    )
  }
  return (
    <Popover
      content={renderContent()}
      trigger='click'
    >
      <span className='pointer iblock pd1x'>
        ({selectedTabIds.length}) <CodeOutlined />
      </span>
    </Popover>
  )
}
