import { auto } from 'manate/react'
import {
  Select
} from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import './footer.styl'
import { paneMap, statusMap } from '../../common/constants'
import BatchInput from './batch-input'
import encodes from '../bookmark-form/encodes'
import { refs } from '../common/ref'
import Qm from '../quick-commands/quick-commands-select'
import AIIcon from '../icons/ai-icon'

const {
  Option
} = Select

const e = window.translate

export default auto(function FooterEntry (props) {
  function handleInfoPanel () {
    window.store.openInfoPanel()
  }

  function batchInput (cmd, selectedTabIds) {
    selectedTabIds.map(id => {
      return refs.get('term-' + id)
    }).forEach(term => {
      term?.batchInput(cmd)
    })
  }

  function handleSwitchEncoding (encode) {
    const term = refs.get('term-' + props.store.activeTabId)
    if (term) {
      term.switchEncoding(encode)
    }
  }

  function isLoading () {
    const { currentTab } = props.store
    if (!currentTab) {
      return true
    }
    const {
      status
    } = currentTab
    return status !== statusMap.success
  }

  function renderBatchInputs () {
    const { store } = props
    const batchProps = {
      input: batchInput,
      tabs: store.tabs,
      batchInputs: store.batchInputs,
      batchInputSelectedTabIds: store.batchInputSelectedTabIds,
      activeTabId: store.activeTabId
    }
    return (
      <div className='terminal-footer-unit terminal-footer-center'>
        <BatchInput
          {...batchProps}
        />
      </div>
    )
  }

  function renderQuickCommands () {
    return (
      <div className='terminal-footer-unit terminal-footer-qm'>
        <Qm />
      </div>
    )
  }

  function renderAIIcon () {
    return (
      <div className='terminal-footer-unit terminal-footer-ai'>
        <AIIcon
          onClick={window.store.handleOpenAIPanel}
        />
      </div>
    )
  }

  function renderEncodingInfo () {
    const selectProps = {
      style: {
        minWidth: 30
      },
      placeholder: e('encode'),
      defaultValue: props.store.currentTab?.encode,
      onSelect: handleSwitchEncoding,
      size: 'small',
      popupMatchSelectWidth: false
    }
    return (
      <div className='terminal-footer-unit terminal-footer-info'>
        <div className='fleft relative'>
          <Select
            {...selectProps}
          >
            {
              encodes.map(k => {
                return (
                  <Option key={k} value={k}>
                    {k.toUpperCase()}
                  </Option>
                )
              })
            }
          </Select>
        </div>
      </div>
    )
  }

  function renderInfoIcon () {
    const loading = isLoading()
    if (loading) {
      return null
    }
    return (
      <div className='terminal-footer-unit terminal-footer-info'>
        <InfoCircleOutlined
          onClick={handleInfoPanel}
          className='pointer font18 terminal-info-icon'
        />
      </div>
    )
  }

  const { tabs, leftSidebarWidth, openedSideBar, currentTab } = props.store
  const pane = currentTab?.pane
  const type = currentTab?.type
  if (
    type === 'rdp' ||
    type === 'web' ||
    type === 'vnc' ||
    pane === paneMap.fileManager ||
    pane === paneMap.sftp ||
    !tabs.length
  ) {
    return (
      <div className='main-footer' />
    )
  }
  const w = 43 + leftSidebarWidth
  const sideProps = openedSideBar
    ? {
        className: 'main-footer',
        style: {
          left: `${w}px`
        }
      }
    : {
        className: 'main-footer'
      }
  return (
    <div {...sideProps}>
      <div className='terminal-footer-flex'>
        {renderAIIcon()}
        {renderQuickCommands()}
        {renderBatchInputs()}
        {renderEncodingInfo()}
        {renderInfoIcon()}
      </div>
    </div>
  )
})
