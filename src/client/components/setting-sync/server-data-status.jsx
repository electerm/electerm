import { syncTypes } from '../../common/constants'
import { useState } from 'react'
import { LoadingOutlined, ReloadOutlined, DiffOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import SyncDataCompare from './sync-data-compare'

const e = window.translate

export default function ServerDataStatus (props) {
  const { store } = window
  const { type, status } = props
  const [loading, setLoading] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const token = store.getSyncToken(type)
  const gistId = store.getSyncGistId(type)
  const canSync = token && (gistId || type === 'custom' || type === 'cloud' || type === syncTypes.webdav)

  async function handleReload () {
    setLoading(true)
    await store.previewServerData(type)
      .catch(store.onError)
    setLoading(false)
  }

  function handleCompare () {
    setShowCompare(!showCompare)
  }

  function renderReloadButton () {
    if (loading) {
      return (
        <LoadingOutlined className='mg1l' />
      )
    }
    return (
      <span>
        <ReloadOutlined
          className='pointer mg1r hover-black'
          onClick={handleReload}
        />
        <span
          className='pointer mg2l hover-black'
          onClick={handleCompare}
        >
          <DiffOutlined className='mg1r' />
          {e('compare') || 'compare'}
        </span>
      </span>
    )
  }

  function renderNoCredentials () {
    return (
      <p>
        <span>{e('syncServerDataStatus')}: -</span>
      </p>
    )
  }

  function renderNoData () {
    return (
      <p>
        <span>{e('syncServerDataStatus')}: -</span>
        {renderReloadButton()}
      </p>
    )
  }

  function renderStatus () {
    const {
      lastSyncTime,
      electermVersion,
      deviceName = 'unknown'
    } = status

    return (
      <div>
        <p>
          <span className='mg1r'>{e('syncServerDataStatus')}:</span>
          <b className='mg1r'>{dayjs(lastSyncTime).format('YYYY-MM-DD HH:mm:ss')}</b>
          <span className='mg1r'>{e('from')}:</span>
          <b className='mg1r'>{deviceName}</b>
          <b className='mg1r'>(v{electermVersion})</b>
          {renderReloadButton()}
        </p>
        {showCompare && <SyncDataCompare syncType={type} />}
      </div>
    )
  }

  if (!canSync) {
    return renderNoCredentials()
  }

  if (!status) {
    return renderNoData()
  }

  return renderStatus()
}
