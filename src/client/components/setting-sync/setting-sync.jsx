/**
 * sync setting module entry
 */

import { Tabs, Spin } from 'antd'
import SyncForm from './setting-sync-form'
import { syncTypes, syncDataMaps } from '../../common/constants'
import DataTransport from './data-import'
import DataSelect from './data-select'
import { pick } from 'lodash-es'
import { auto } from 'manate/react'
import deepCopy from 'json-deep-copy'

export default auto(function SyncSettingEntry (props) {
  const handleChange = (key) => {
    window.store.syncType = key
  }
  const {
    config
  } = props
  const {
    syncSetting
  } = config
  const {
    store
  } = window
  function renderForm () {
    const syncProps = {
      ...syncSetting,
      ...pick(props, [
        'isSyncingSetting',
        'isSyncDownload',
        'isSyncUpload',
        'syncType',
        'serverStatus'
      ]),
      serverStatus: deepCopy(store.syncServerStatus[props.syncType])
    }
    const type = props.syncType
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
        encrypt={syncSetting.syncEncrypt}
        formData={formData}
      />
    )
  }

  const syncItems = Object.keys(syncTypes).map(type => {
    return {
      key: type,
      label: type,
      children: null
    }
  })
  const {
    dataSyncSelected
  } = props.config
  const arr = dataSyncSelected && dataSyncSelected !== 'all'
    ? dataSyncSelected.split(',')
    : Object.keys(syncDataMaps)
  const dataSelectProps = {
    dataSyncSelected: arr
  }
  const dataImportProps = {
    config
  }
  return (
    <div className='pd2l'>
      <DataTransport {...dataImportProps} />
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
