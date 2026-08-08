import { auto } from 'manate/react'
import {
  Select,
  Dropdown
} from 'antd'
import { InfoCircleOutlined, TranslationOutlined, DoubleRightOutlined } from '@ant-design/icons'
import './footer.styl'
import { statusMap } from '../../common/constants'
import BatchInput from './batch-input'
import encodes from '../bookmark-form/common/encodes'
import { refs } from '../common/ref'
import Qm from '../quick-commands/quick-commands-select'
import AIIcon from '../icons/ai-icon'
import { isAIDisabled } from '../../common/ai-feature'
import CmdHistory from './cmd-history'

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
      batchInputSelectedTabIds: store.batchInputSelectedTabIds,
      activeTabId: store.activeTabId,
      isMobile: store.isMobile
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
    if (props.store.isMobile) {
      const items = encodes.map(k => {
        return {
          key: k,
          label: k.toUpperCase(),
          onClick: () => handleSwitchEncoding(k)
        }
      })
      return (
        <div className='terminal-footer-unit terminal-footer-info'>
          <Dropdown
            menu={{ items }}
            placement='topRight'
            trigger={['click']}
          >
            <TranslationOutlined
              className='pointer font18 mobile-encode-trigger'
            />
          </Dropdown>
        </div>
      )
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

  function renderCmdHistory () {
    return (
      <div className='terminal-footer-unit terminal-footer-history'>
        <CmdHistory store={props.store} />
      </div>
    )
  }

  function handleShowSidebar () {
    window.store.toggleLeftSideBar()
  }

  const {
    leftSidePanelWidth,
    leftSideBarWidth,
    openedSideBar,
    inActiveTerminal
  } = props.store
  const w = leftSideBarWidth + leftSidePanelWidth
  // icon bar hidden: show a control on the left of the footer to bring the
  // sidebar back
  const showSidebarIcon = leftSideBarWidth === 0
    ? (
      <div className='terminal-footer-unit terminal-footer-show-sidebar'>
        <DoubleRightOutlined
          className='pointer font18 show-sidebar-icon'
          onClick={handleShowSidebar}
        />
      </div>
      )
    : null
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
  if (
    !inActiveTerminal
  ) {
    return (
      <div className='main-footer' {...sideProps}>
        {showSidebarIcon}
      </div>
    )
  }
  return (
    <div {...sideProps}>
      <div className='terminal-footer-flex'>
        {showSidebarIcon}
        {!isAIDisabled() && renderAIIcon()}
        {renderCmdHistory()}
        {renderQuickCommands()}
        {renderBatchInputs()}
        {renderEncodingInfo()}
        {renderInfoIcon()}
      </div>
    </div>
  )
})
