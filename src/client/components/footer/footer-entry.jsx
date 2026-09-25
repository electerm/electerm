import { auto } from 'manate/react'
import {
  Select,
  Dropdown,
  Badge
} from 'antd'
import { BarChartOutlined, TranslationOutlined, DoubleRightOutlined, FunctionOutlined } from '@ant-design/icons'
import './footer.styl'
import { statusMap } from '../../common/constants'
import BatchInput from './batch-input'
import encodes from '../bookmark-form/common/encodes'
import { refs } from '../common/ref'
import Qm from '../quick-commands/quick-commands-select'
import TriggerSessionModal from '../triggers/trigger-session-modal'
import AIIcon from '../icons/ai-icon'
import { isAIDisabled } from '../../common/ai-feature'
import CmdHistory from './cmd-history'

const e = window.translate

const {
  Option
} = Select

export default auto(function FooterEntry (props) {
  function handleInfoPanel () {
    window.store.toggleInfoPanel()
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
    const { rightPanelVisible, rightPanelTab, quickCommandsInRightPanel } = props.store
    // the Q button only owns the right panel while the panel lives there; in
    // the footer it toggles the floating box instead, which shows its own state
    const active = quickCommandsInRightPanel &&
      rightPanelVisible &&
      rightPanelTab === 'quickCommands'
    return (
      <div className='terminal-footer-unit terminal-footer-qm'>
        <Qm active={active} />
      </div>
    )
  }

  function renderTriggers () {
    const { store } = props
    const tab = store.currentTab
    let count = 0
    try {
      count = tab ? store.getEffectiveTriggers(tab).length : store.triggers.length
    } catch (err) {
      count = 0
    }
    return (
      <div className='terminal-footer-unit terminal-footer-triggers'>
        <Badge
          count={count}
          size='small'
          offset={[-2, 2]}
        >
          <FunctionOutlined
            onClick={() => store.toggleTriggerSessionModal(true)}
            className='pointer font14 terminal-trigger-icon'
            title={e('triggers')}
          />
        </Badge>
        <TriggerSessionModal store={store} />
      </div>
    )
  }

  function handleAIPanel () {
    window.store.toggleAIPanel()
  }

  function renderAIIcon () {
    const { rightPanelVisible, rightPanelTab } = props.store
    // same contract as the info icon: lit while its panel is open
    const active = rightPanelVisible && rightPanelTab === 'ai'
    return (
      <div className='terminal-footer-unit terminal-footer-ai'>
        <AIIcon
          onClick={handleAIPanel}
          className={active ? 'active' : ''}
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
      variant: 'borderless',
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
    const { rightPanelVisible, rightPanelTab } = props.store
    // keep the icon lit while its panel is open so it reads as "click to close"
    const active = rightPanelVisible && rightPanelTab === 'info'
    return (
      <div className='terminal-footer-unit terminal-footer-info'>
        <BarChartOutlined
          onClick={handleInfoPanel}
          className={'pointer font14 terminal-info-icon' + (active ? ' active' : '')}
          title={e('info')}
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
    inActiveTerminal,
    rightPanelVisible,
    rightPanelPinned,
    rightPanelWidth,
    isMobile
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
  // The footer mirrors the space layout.jsx reserves on both sides.
  // Left: reserve while the panel is open OR pinned. A pinned left panel is
  // always open, so this is a superset of the pin state — and it is what keeps
  // the footer from painting over the panel, which spans bottom 0 in both
  // states. Right: reserve only for a pinned panel, because the unpinned right
  // panel is an overlay that stops above the footer and so never needs the
  // space. Mobile reserves nothing on either side, matching layout.jsx, and the
  // right panel has no pin control there at all.
  const footerStyle = {}
  if (openedSideBar && !isMobile) {
    footerStyle.left = `${w}px`
  }
  if (rightPanelVisible && rightPanelPinned && !isMobile) {
    footerStyle.right = `${rightPanelWidth}px`
  }
  const sideProps = {
    className: 'main-footer',
    style: footerStyle
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
        {renderTriggers()}
        {renderBatchInputs()}
        {renderEncodingInfo()}
        {renderInfoIcon()}
      </div>
    </div>
  )
})
