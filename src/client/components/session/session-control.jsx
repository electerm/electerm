/**
 * Session control bar — pane tabs and action icons.
 * On mobile a menu icon is shown; clicking it toggles the control icons.
 */
import {
  SearchOutlined,
  FullscreenOutlined,
  PaperClipOutlined,
  ApartmentOutlined,
  MoreOutlined,
  MenuOutlined,
  ColumnWidthOutlined,
  LogoutOutlined,
  PlusOutlined,
  MinusOutlined
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
import { rightClickBehaviors } from '../../common/right-click-behavior'
import SerialControl from './serial-control'
import './session-control.styl'

const e = window.translate

function Action ({ icon: Icon, label, title = label, className, pressed, onClick }) {
  return (
    <button type='button' className={classnames('session-action', className)} title={title} aria-pressed={pressed} onClick={onClick}>
      <Icon />{label}
    </button>
  )
}

export default function SessionControl (props) {
  const {
    tab,
    isMobile,
    isTouchDevice,
    isDisabled,
    isSshDisabled,
    isNotTerminalType,
    canSplitView,
    sftpPathFollowSsh,
    keepaliveEnabled,
    broadcastInput,
    wrapDisabled,
    rightClickBehavior,
    toggleCheckSftpPathFollowSsh,
    onSshSftpSplitView,
    toggleKeepalive,
    toggleBroadcastInput,
    toggleWrap,
    onFullscreen,
    onOpenSearch,
    onOpenContextMenu,
    onExitGracefully,
    onZoomFontSize
  } = props

  if (isNotTerminalType) {
    return null
  }

  const isSsh = !!tab.authType
  const isLocal = !isSsh && (tab.type === connectionMap.local || !tab.type)
  const showSshFeatures = isSsh || isLocal

  // ---- sub-renderers ----

  function renderPaneControl () {
    return null
  }

  function renderSftpPathFollowControl () {
    if (isDisabled) {
      return null
    }
    const { enableSsh } = tab
    const checkTxt = e('sftpPathFollowSsh')
    if (isSsh && !isMobile && enableSsh !== false) {
      return (
        <label className='sftp-follow-label'>
          <input type='checkbox' checked={sftpPathFollowSsh} onChange={toggleCheckSftpPathFollowSsh} />
          {checkTxt}
        </label>
      )
    }
    const checkProps = {
      onClick: toggleCheckSftpPathFollowSsh,
      className: classnames(
        'sftp-follow-ssh-icon sess-icon pointer',
        {
          active: sftpPathFollowSsh
        }
      )
    }
    return (
      <>
        {
          isSsh && enableSsh !== false
            ? (
              <Tooltip title={checkTxt}>
                <span {...checkProps}>
                  <PaperClipOutlined />
                </span>
              </Tooltip>
              )
            : null
        }
      </>
    )
  }

  function renderSplitToggle () {
    if (!canSplitView || isNotTerminalType || !isSsh) {
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
        <button
          type='button'
          aria-label='SFTP'
          aria-expanded={!!sshSftpSplitView}
          className={cls}
          onClick={onSshSftpSplitView}
        >
          <SplitViewIcon />
          {!isMobile && ' SFTP'}
        </button>
      </Tooltip>
    )
  }

  function renderKeepaliveIcon () {
    if (isSshDisabled || !showSshFeatures) {
      return null
    }
    return <Action icon={HeartbeatIcon} label={e('keepalive')} className='keepalive-icon' pressed={keepaliveEnabled} onClick={toggleKeepalive} />
  }

  function renderBroadcastIcon () {
    if (isSshDisabled || !showSshFeatures) {
      return null
    }
    return <Action icon={ApartmentOutlined} label={window.getLang()?.broadcastLabel || e('broadcastInput')} title={e('broadcastInput')} className='broadcast-icon' pressed={broadcastInput} onClick={toggleBroadcastInput} />
  }

  function renderWrapIcon () {
    const title = e(wrapDisabled ? 'enableWrap' : 'disableWrap')
    return <Action icon={ColumnWidthOutlined} label={title} className='wrap-toggle-icon' onClick={toggleWrap} />
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

  // control lines, received data view and raw send, see serial-control.jsx.
  // mobile has one icon that opens a panel: the toolbar is too narrow for
  // the row of controls
  function renderSerialControl () {
    if (tab.type !== terminalSerialType) {
      return null
    }
    return <SerialControl tabId={tab.id} compact={isMobile} />
  }

  function renderSearchIcon () {
    return <Action icon={SearchOutlined} label={e('search')} onClick={onOpenSearch} />
  }

  function renderFullscreenIcon () {
    return <Action icon={FullscreenOutlined} label={e('fullscreen')} className='fullscreen-control-icon' onClick={onFullscreen} />
  }

  function renderFontSizeIcons () {
    // touch screens have no ctrl +/- shortcut to resize the terminal font,
    // so the icons only show there — driven by store.isTouchDevice, which
    // follows the input the user is actually using (see main.jsx).
    if (!isTouchDevice) {
      return null
    }
    const cls = 'mg1r icon-info iblock pointer spliter font-size-control-icon'
    return (
      <>
        <Action
          icon={MinusOutlined} label={e('zoomout')}
          className={cls}
          onClick={() => onZoomFontSize(-1)}
        />
        <Action
          icon={PlusOutlined} label={e('zoomin')}
          className={cls}
          onClick={() => onZoomFontSize(1)}
        />
      </>
    )
  }

  /**
   * Touch devices have no right click, so the terminal's context menu needs a
   * visible way in: this icon, next to the fullscreen icon on the desktop
   * toolbar and next to the three-dot toggle in the mobile one (see below).
   * Hidden when there is no menu to open — right click behaviour 'paste' and
   * 'passthrough' both drop the menu (see right-click-behavior.js), and the
   * setting only ever acts on the terminal pane.
   */
  function renderContextMenuIcon (inMobileBar) {
    if (
      !isTouchDevice ||
      rightClickBehavior !== rightClickBehaviors.context ||
      tab.pane !== paneMap.terminal
    ) {
      return null
    }
    const cls = classnames(
      'iblock pointer spliter context-menu-control-icon',
      inMobileBar ? 'mobile-context-menu-toggle' : 'mg1r icon-info'
    )
    return (
      <Action
        icon={MenuOutlined} label={e('menu')}
        className={cls}
        onClick={onOpenContextMenu}
      />
    )
  }

  function renderTermControls (skipContextMenuIcon) {
    const { pane } = tab
    if (pane !== paneMap.terminal) {
      return null
    }
    return (
      <div className='fright term-controls'>
        {renderFontSizeIcons()}
        {skipContextMenuIcon ? null : renderContextMenuIcon()}
        {renderFullscreenIcon()}
        {renderSearchIcon()}
      </div>
    )
  }

  // ---- mobile ----

  if (isMobile) {
    const extraIcons = (
      <div className='mobile-control-icons'>
        {renderSplitToggle()}
        {renderSftpPathFollowControl()}
        {renderKeepaliveIcon()}
        {renderBroadcastIcon()}
        {renderWrapIcon()}
        {renderExitGracefullyIcon()}
        {renderSerialControl()}
        {renderTermControls(true)}
      </div>
    )
    return (
      <div className='terminal-control mobile-session-control'>
        {renderPaneControl()}
        {renderContextMenuIcon(true)}
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
      {renderSplitToggle()}
      {renderSftpPathFollowControl()}
      {renderKeepaliveIcon()}
      {renderBroadcastIcon()}
      {renderWrapIcon()}
      {renderExitGracefullyIcon()}
      {renderSerialControl()}
      {renderTermControls()}
    </div>
  )
}
