/**
 * sync setting module entry
 */
import { auto } from 'manate/react'
import { Tabs, Spin } from 'antd'
import SyncForm from './setting-sync-form'
import { syncTypes, syncDataMaps } from '../../common/constants'
import DataTransport from './data-import'
import DataSelect from './data-select'
import { pick } from 'lodash-es'

export default auto(function SyncSettingEntry (props) {
  const handleChange = (key) => {
    window.store.syncType = key
  }

  function renderForm () {
    const {
      store
    } = props
    const {
      syncSetting
    } = store.config
    const syncProps = {
      store,
      ...syncSetting,
      ...pick(store, [
        'autofocustrigger',
        'isSyncingSetting',
        'isSyncDownload',
        'isSyncUpload',
        'syncType'
      ])
    }
    const type = store.syncType
    const formData = {
      gistId: syncSetting[type + 'GistId'],
      token: syncSetting[type + 'AccessToken'],
      url: syncSetting[type + 'Url'],
      apiUrl: syncSetting[type + 'ApiUrl'],
      lastSyncTime: syncSetting[type + 'LastSyncTime'],
      syncPassword: syncSetting[type + 'SyncPassword']
    }
    return (
      <SyncForm
        {...syncProps}
        syncType={type}
        encrypt={syncSetting.syncEncrypt}
        formData={formData}
      />
    )
  }

  const {
    store
  } = props

  const syncItems = Object.keys(syncTypes).map(type => {
    return {
      key: type,
      label: type,
      children: null
    }
  })
  const {
    dataSyncSelected
  } = store.config
  const arr = dataSyncSelected && dataSyncSelected !== 'all'
    ? dataSyncSelected.split(',')
    : Object.keys(syncDataMaps)
  const dataSelectProps = {
    dataSyncSelected: arr
  }
  return (
    <div className='pd2l'>
      <DataTransport store={store} />
      <Spin spinning={store.isSyncingSetting}>
        <Tabs
          activeKey={store.syncType}
          onChange={handleChange}
          items={syncItems}
        />
        {
          renderForm()
        }
        <DataSelect {...dataSelectProps} />
      </Spin>
    </div>
  )
})
