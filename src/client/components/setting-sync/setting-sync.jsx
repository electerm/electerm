/**
 * sync setting module entry
 */

import { Tabs, Spin } from 'antd'
import { useEffect } from 'react'
import SyncForm from './setting-sync-form'
import { allowedSyncTypes, syncDataMaps } from '../../common/constants'
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
  const types = allowedSyncTypes()
  const type = types.includes(props.syncType)
    ? props.syncType
    : types[0]
  useEffect(() => {
    if (store.syncType !== type) {
      store.syncType = type
    }
  }, [type])
  function renderForm () {
    const syncProps = {
      ...syncSetting,
      ...pick(props, [
        'isSyncingSetting',
        'isSyncDownload',
        'isSyncUpload',
        'serverStatus'
      ]),
      syncType: type,
      serverStatus: deepCopy(store.syncServerStatus[type])
    }
    const formData = {
      gistId: syncSetting[type + 'GistId'],
      token: syncSetting[type + 'AccessToken'],
      url: syncSetting[type + 'Url'],
      apiUrl: syncSetting[type + 'ApiUrl'],
      lastSyncTime: syncSetting[type + 'LastSyncTime'],
      syncPassword: syncSetting[type + 'SyncPassword'],
      proxy: syncSetting[type + 'Proxy'],
      // WebDAV specific fields
      serverUrl: syncSetting[type + 'ServerUrl'],
      username: syncSetting[type + 'Username'],
      password: syncSetting[type + 'Password'],
      skipVerify: syncSetting[type + 'SkipVerify'] || false
    }
    return (
      <SyncForm
        {...syncProps}
        encrypt={syncSetting.syncEncrypt}
        formData={formData}
      />
    )
  }
  const syncItems = types.map(type => {
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
          activeKey={type}
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
