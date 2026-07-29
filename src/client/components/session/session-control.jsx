/**
 * Session control bar — pane tabs and action icons.
 * On mobile a menu icon is shown; clicking it toggles the control icons.
 */
import {
  SearchOutlined,
  FullscreenOutlined,
  PaperClipOutlined,
  CloseOutlined,
  ApartmentOutlined,
  MoreOutlined,
  ColumnWidthOutlined,
  LogoutOutlined
} from '@ant-design/icons'
import { Tooltip, Popover } from 'antd'
import classnames from 'classnames'
import {
  paneMap,
  connectionMap,
  terminalSerialType
} from '../../common/constants'
import { SplitViewIcon } from '../icons/split-view'
import { HeartbeatIcon } from '../icons/heartbeat'
import './session-control.styl'

const e = window.translate

export default function SessionControl (props) {
  const {
    tab,
    isMobile,
    isDisabled,
    isSshDisabled,
    isNotTerminalType,
    canSplitView,
    sftpPathFollowSsh,
    keepaliveEnabled,
    broadcastInput,
    wrapDisabled,
    delKeyPressed,
    hideDelKeyTip,
    onChangePane,
    toggleCheckSftpPathFollowSsh,
    onSshSftpSplitView,
    toggleKeepalive,
    toggleBroadcastInput,
    toggleWrap,
    onFullscreen,
    onOpenSearch,
    onDismissDelKeyTip,
    onExitGracefully
  } = props

  if (isNotTerminalType) {
    return null
  }

  const isSsh = !!tab.authType
  const isLocal = !isSsh && (tab.type === connectionMap.local || !tab.type)
  const showSshFeatures = isSsh || isLocal

  // ---- sub-renderers ----

  function renderPaneControl () {
    if (isDisabled) {
      return null
    }
    const { sshSftpSplitView, pane } = tab
    if (sshSftpSplitView && canSplitView) {
      return null
    }
    const types = [
      paneMap.terminal,
      paneMap.fileManager
    ]
    const controls = [
      isSsh ? paneMap.ssh : paneMap.terminal
    ]
    if (isSsh || isLocal) {
      controls.push(isSsh ? paneMap.sftp : paneMap.fileManager)
    }
    return (
      <div className='term-sftp-tabs fleft'>
        {
          controls.map((type, i) => {
            const cls = classnames(
              'type-tab',
              type,
              {
                active: types[i] === pane
              }
            )
            return (
              <span
                className={cls}
                key={type + '_' + i}
                onClick={() => onChangePane(types[i])}
              >
                <span className='type-tab-txt'>
                  {e(type)}
                  <span className='type-tab-line' />
                </span>
              </span>
            )
          })
        }
      </div>
    )
  }

  function renderDelTip (isS) {
    if (!isS || hideDelKeyTip || !delKeyPressed) {
      return null
    }
    return (
      <div className='type-tab'>
        <span className='mg1r'>Try <b>Shift + Backspace</b>?</span>
        <CloseOutlined
          onClick={onDismissDelKeyTip}
          className='pointer'
        />
      </div>
    )
  }

  function renderSftpPathFollowControl () {
    if (isDisabled) {
      return null
    }
    const { pane, enableSsh, sshSftpSplitView } = tab
    const checkTxt = e('sftpPathFollowSsh')
    const checkProps = {
      onClick: toggleCheckSftpPathFollowSsh,
      className: classnames(
        'sftp-follow-ssh-icon sess-icon pointer',
        {
          active: sftpPathFollowSsh
        }
      )
    }
    const isS = pane === paneMap.terminal ||
      sshSftpSplitView
    return (
      <>
        {
          (isSsh && enableSsh) || isLocal
            ? (
              <Tooltip title={checkTxt}>
                <span {...checkProps}>
                  <PaperClipOutlined />
                </span>
              </Tooltip>
              )
            : null
        }
        {renderDelTip(isS)}
      </>
    )
  }

  function renderSplitToggle () {
    if (isMobile) {
      return null
    }
    if (!canSplitView || isNotTerminalType || !showSshFeatures) {
      return null
    }
    const title = e('sshSftpSplitView')
    const { sshSftpSplitView } = tab
    const cls = classnames(
      'pointer sess-icon split-view-toggle',
      {
        active: sshSftpSplitView
      }
    )
    return (
      <Tooltip title={title} placement='bottomLeft'>
        <span
          className={cls}
          onClick={onSshSftpSplitView}
        >
          <SplitViewIcon />
        </span>
      </Tooltip>
    )
  }

  function renderKeepaliveIcon () {
    if (isSshDisabled || !showSshFeatures) {
      return null
    }
    const title = e('keepalive')
    const iconProps = {
      className: classnames('sess-icon pointer keepalive-icon', {
        active: keepaliveEnabled
      }),
      onClick: toggleKeepalive
    }
    return (
      <Tooltip title={title}>
        <HeartbeatIcon {...iconProps} />
      </Tooltip>
    )
  }

  function renderBroadcastIcon () {
    if (isSshDisabled || !showSshFeatures) {
      return null
    }
    const title = e('broadcastInput')
    const iconProps = {
      className: classnames('sess-icon pointer broadcast-icon', {
        active: broadcastInput
      }),
      onClick: toggleBroadcastInput
    }
    return (
      <Tooltip title={title}>
        <ApartmentOutlined {...iconProps} />
      </Tooltip>
    )
  }

  function renderWrapIcon () {
    const title = e(wrapDisabled ? 'enableWrap' : 'disableWrap')
    const iconProps = {
      className: classnames('sess-icon pointer wrap-toggle-icon', {
        active: wrapDisabled
      }),
      onClick: toggleWrap
    }
    return (
      <Tooltip title={title}>
        <ColumnWidthOutlined {...iconProps} />
      </Tooltip>
    )
  }

  function renderExitGracefullyIcon () {
    if (tab.type !== terminalSerialType) {
      return null
    }
    const title = e('exitGracefully')
    return (
      <Tooltip title={title}>
        <LogoutOutlined
          className='sess-icon pointer exit-gracefully-icon'
          onClick={onExitGracefully}
        />
      </Tooltip>
    )
  }

  function renderSearchIcon () {
    const title = e('search')
    return (
      <Tooltip title={title} placement='bottomLeft'>
        <SearchOutlined
          className='mg1r icon-info iblock pointer spliter'
          onClick={onOpenSearch}
        />
      </Tooltip>
    )
  }

  function renderFullscreenIcon () {
    const title = e('fullscreen')
    return (
      <Tooltip title={title} placement='bottomLeft'>
        <FullscreenOutlined
          className='mg1r icon-info iblock pointer spliter fullscreen-control-icon'
          onClick={onFullscreen}
        />
      </Tooltip>
    )
  }

  function renderTermControls () {
    const { pane } = tab
    if (pane !== paneMap.terminal) {
      return null
    }
    return (
      <div className='fright term-controls'>
        {renderFullscreenIcon()}
        {renderSearchIcon()}
      </div>
    )
  }

  // ---- mobile ----

  if (isMobile) {
    const extraIcons = (
      <div className='mobile-control-icons'>
        {renderSftpPathFollowControl()}
        {renderKeepaliveIcon()}
        {renderBroadcastIcon()}
        {renderWrapIcon()}
        {renderExitGracefullyIcon()}
        {renderTermControls()}
      </div>
    )
    return (
      <div className='terminal-control mobile-session-control'>
        {renderPaneControl()}
        <Popover
          content={extraIcons}
          trigger='click'
          placement='bottomRight'
        >
          <MoreOutlined className='mobile-control-toggle pointer' />
        </Popover>
      </div>
    )
  }

  // ---- desktop ----
  return (
    <div className='terminal-control fix'>
      {renderPaneControl()}
      {renderSftpPathFollowControl()}
      {renderSplitToggle()}
      {renderKeepaliveIcon()}
      {renderBroadcastIcon()}
      {renderWrapIcon()}
      {renderExitGracefullyIcon()}
      {renderTermControls()}
    </div>
  )
}
