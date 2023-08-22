/**
 * sync setting module entry
 */
import { Component } from '../common/react-subx'
import { Tabs, Spin } from 'antd'
import SyncForm from './setting-sync-form'
import { syncTypes } from '../../common/constants'
import { DataTransport } from './data-import'
import _ from 'lodash'

export default class SyncSettingEntry extends Component {
  handleChange = (key) => {
    this.props.store.syncType = key
  }

  render () {
    const {
      store
    } = this.props
    const {
      syncSetting
    } = store.config
    const syncProps = {
      store,
      ...syncSetting,
      ..._.pick(store, [
        'autofocustrigger',
        'isSyncingSetting',
        'isSyncDownload',
        'isSyncUpload',
        'syncType'
      ])
    }
    const syncItems = Object.keys(syncTypes).map(type => {
      const formData = {
        gistId: syncSetting[type + 'GistId'],
        token: syncSetting[type + 'AccessToken'],
        url: syncSetting[type + 'Url'],
        apiUrl: syncSetting[type + 'ApiUrl'],
        lastSyncTime: syncSetting[type + 'LastSyncTime'],
        syncPassword: syncSetting[type + 'SyncPassword']
      }
      return {
        key: type,
        label: type,
        children: (
          <SyncForm
            {...syncProps}
            syncType={store.syncType}
            encrypt={syncSetting.syncEncrypt}
            formData={formData}
          />
        )
      }
    })
    console.log('props.syncType', store.syncType)
    return (
      <div className='pd2l'>
        <DataTransport store={store} />
        <Spin spinning={store.isSyncingSetting}>
          <Tabs
            activeKey={store.syncType}
            onChange={this.handleChange}
            items={syncItems}
          />
        </Spin>
      </div>
    )
  }
}
