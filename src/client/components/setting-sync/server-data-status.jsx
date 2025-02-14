import { useState } from 'react'
import { LoadingOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

const e = window.translate

export default function ServerDataStatus (props) {
  const { store } = window
  const { type, status } = props
  const [loading, setLoading] = useState(false)
  const token = store.getSyncToken(type)
  const gistId = store.getSyncGistId(type)
  const canSync = token && (gistId || type === 'custom' || type === 'cloud')

  async function handleReload () {
    setLoading(true)
    await store.previewServerData(type)
      .catch(store.onError)
    setLoading(false)
  }

  function renderReloadButton () {
    if (loading) {
      return (
        <LoadingOutlined className='mg1l' />
      )
    }
    return (
      <ReloadOutlined
        className='pointer mg1l hover-black'
        onClick={handleReload}
      />
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
      <p>
        <span className='mg1r'>{e('syncServerDataStatus')}:</span>
        <b className='mg1r'>{dayjs(lastSyncTime).format('YYYY-MM-DD HH:mm:ss')}</b>
        <span className='mg1r'>{e('from')}:</span>
        <b className='mg1r'>{deviceName}</b>
        <b className='mg1r'>(v{electermVersion})</b>
        {renderReloadButton()}
      </p>
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
