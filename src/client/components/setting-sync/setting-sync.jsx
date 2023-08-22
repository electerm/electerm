/**
 * sync setting module entry
 */

import { Tabs, Spin } from 'antd'
import SyncForm from './setting-sync-form'
import { syncTypes } from '../../common/constants'
import { DataTransport } from './data-import'

export default function SyncSettingEntry (props) {
  function handleChange (key) {
    props.store.syncType = key
  }
  const syncItems = Object.keys(syncTypes).map(type => {
    const formData = {
      gistId: props[type + 'GistId'],
      token: props[type + 'AccessToken'],
      url: props[type + 'Url'],
      apiUrl: props[type + 'ApiUrl'],
      lastSyncTime: props[type + 'LastSyncTime'],
      syncPassword: props[type + 'SyncPassword']
    }
    return {
      key: type,
      label: type,
      children: (
        <SyncForm
          {...props}
          syncType={type}
          encrypt={props.syncEncrypt}
          formData={formData}
        />
      )
    }
  })

  return (
    <div className='pd2l'>
      <DataTransport store={props.store} />
      <Spin spinning={props.isSyncingSetting}>
        <Tabs
          activeKey={props.syncType}
          onChange={handleChange}
          items={syncItems}
        />
      </Spin>
    </div>
  )
}
