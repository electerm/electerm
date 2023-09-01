/**
 * sync setting module entry
 */
import { Component } from '../common/react-subx'
import { Tabs, Spin } from 'antd'
import SyncForm from './setting-sync-form'
import { syncTypes } from '../../common/constants'
import { DataTransport } from './data-import'
import { pick } from 'lodash-es'

export default class SyncSettingEntry extends Component {
  handleChange = (key) => {
    this.props.store.syncType = key
  }

  renderForm () {
    const {
      store
    } = this.props
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

  render () {
    const {
      store
    } = this.props

    const syncItems = Object.keys(syncTypes).map(type => {
      return {
        key: type,
        label: type,
        children: null
      }
    })
    return (
      <div className='pd2l'>
        <DataTransport store={store} />
        <Spin spinning={store.isSyncingSetting}>
          <Tabs
            activeKey={store.syncType}
            onChange={this.handleChange}
            items={syncItems}
          />
          {
            this.renderForm()
          }
        </Spin>
      </div>
    )
  }
}
