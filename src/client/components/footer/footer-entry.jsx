import { auto } from 'manate/react'
import {
  Select
} from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import './footer.styl'
import { paneMap, terminalActions, statusMap } from '../../common/constants'
import postMessage from '../../common/post-msg'
import BatchInput from './batch-input'
import encodes from '../bookmark-form/encodes'
import Qm from '../quick-commands/quick-commands-select'

const {
  Option
} = Select

const e = window.translate

export default auto(function FooterEntry (props) {
  function handleInfoPanel () {
    const { activeTerminalId } = props.store
    postMessage({
      action: terminalActions.showInfoPanel,
      activeSplitId: activeTerminalId
    })
  }

  function batchInput (cmd, toAll) {
    const { activeTerminalId } = props.store
    postMessage({
      action: terminalActions.batchInput,
      activeSplitId: activeTerminalId,
      toAll,
      cmd
    })
  }

  function handleSwitchEncoding (encode) {
    const { activeTerminalId } = props.store
    postMessage({
      encode,
      action: terminalActions.changeEncode,
      activeSplitId: activeTerminalId
    })
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
    return (
      <div className='terminal-footer-unit terminal-footer-center'>
        <BatchInput
          input={batchInput}
          batchInputs={props.store.batchInputs}
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

  function renderEncodingInfo () {
    const selectProps = {
      style: {
        minWidth: 30
      },
      placeholder: e('encode'),
      defaultValue: props.currentTab?.encode,
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
        {renderQuickCommands()}
        {renderBatchInputs()}
        {renderEncodingInfo()}
        {renderInfoIcon()}
      </div>
    </div>
  )
})
