import {
  ArrowUpOutlined,
  EyeInvisibleFilled,
  EyeFilled,
  ReloadOutlined,
  ArrowRightOutlined,
  LoadingOutlined
} from '@ant-design/icons'
import {
  Input,
  Tooltip
} from 'antd'
import {
  typeMap
} from '../../common/constants'
import classnames from 'classnames'
import AddrBookmark from './address-bookmark'

const e = window.translate

function renderAddonBefore (props, realPath) {
  const {
    type,
    host
  } = props
  const isShow = props[`${type}ShowHiddenFile`]
  const title = `${isShow ? e('hide') : e('show')} ${e('hfd')}`
  const Icon = isShow ? EyeFilled : EyeInvisibleFilled
  return (
    <div>
      <Tooltip
        title={title}
        placement='topLeft'
        arrow={{ pointAtCenter: true }}
      >
        <Icon
          type='eye'
          className='mg1r'
          onClick={() => props.toggleShowHiddenFile(type)}
        />
      </Tooltip>
      <Tooltip
        title={e('goParent')}
        arrow={{ pointAtCenter: true }}
        placement='topLeft'
      >
        <ArrowUpOutlined
          onClick={() => props.goParent(type)}
          className='mg1r'
        />
      </Tooltip>
      <AddrBookmark
        store={window.store}
        realPath={realPath}
        host={host}
        type={type}
        onClickHistory={props.onClickHistory}
      />
    </div>
  )
}

function renderAddonAfter (isLoadingRemote, onGoto, GoIcon, type) {
  return (
    <GoIcon
      onClick={isLoadingRemote ? () => null : () => onGoto(type)}
    />
  )
}

function renderHistory (props, type) {
  const currentPath = props[type + 'Path']
  const options = props[type + 'PathHistory']
    .filter(o => o !== currentPath)
  const focused = props[type + 'InputFocus']
  if (!options.length) {
    return null
  }
  const cls = classnames(
    'sftp-history',
    'animated',
    `sftp-history-${type}`,
    { focused }
  )
  return (
    <div
      className={cls}
    >
      {
        options.map(o => {
          return (
            <div
              key={o}
              className='sftp-history-item'
              onClick={() => props.onClickHistory(type, o)}
            >
              {o}
            </div>
          )
        })
      }
    </div>
  )
}

export default function AddressBar (props) {
  const {
    loadingSftp,
    type,
    onGoto
  } = props
  const n = `${type}PathTemp`
  const path = props[n]
  const realPath = props[`${type}Path`]
  const isLoadingRemote = type === typeMap.remote && loadingSftp
  const GoIcon = isLoadingRemote
    ? LoadingOutlined
    : (realPath === path ? ReloadOutlined : ArrowRightOutlined)
  return (
    <div className='pd1y sftp-title-wrap'>
      <div className='sftp-title'>
        <Input
          value={path}
          onChange={e => props.onChange(e, n)}
          onPressEnter={e => props.onGoto(type, e)}
          addonBefore={renderAddonBefore(props, realPath)}
          onFocus={() => props.onInputFocus(type)}
          onBlur={() => props.onInputBlur(type)}
          disabled={loadingSftp}
          addonAfter={
            renderAddonAfter(isLoadingRemote, onGoto, GoIcon, type)
          }
        />
        {renderHistory(props, type)}
      </div>
    </div>
  )
}
