/**
 * setting sync panel，
 */

/**
 * bookmark form
 */
import React from 'react'
import {
  Form, Button, Input,
  notification,
  Tooltip, Icon
} from 'antd'
import { validateFieldsAndScroll } from '../../common/dec-validate-and-scroll'
import { formItemLayout, tailFormItemLayout } from '../../common/form-layout'
import Link from '../common/external-link'
import _ from 'lodash'
import moment from 'moment'
import { syncTokenCreateUrls } from '../../common/constants'
import './sync.styl'

const FormItem = Form.Item
const { prefix } = window
const e = prefix('form')
const ss = prefix('settingSync')

export class SyncForm extends React.Component {
  state = {
    hide: true
  }

  componentDidUpdate (prevProps) {
    if (
      !_.isEqual(prevProps.formData, this.props.formData)
    ) {
      this.props.form.resetFields()
    }
  }

  showGistForm = () => {
    this.setState({
      hide: false
    })
  }

  disabled = () => {
    const {
      token,
      gistId
    } = this.props.formData
    return !token || !gistId
  }

  save = async () => {
    const res = await this.validateFieldsAndScroll()
    if (!res) {
      return
    }
    const { syncType } = this.props
    const up = {
      [syncType + 'AccessToken']: res.token
    }
    if (res.gistId) {
      up[syncType + 'GistId'] = res.gistId
    }
    this.props.store.updateSyncSetting(up)
    const test = await this.props.store.testSyncToken(syncType, res.gistId)
    if (!test) {
      return notification.error({
        message: 'token invalid'
      })
    }
    if (!this.props.formData.gistId) {
      this.props.store.createGist(syncType)
    }
  }

  upload = async () => {
    this.props.store.uploadSetting(this.props.syncType)
  }

  download = () => {
    this.props.store.downloadSetting(this.props.syncType)
  }

  // onChangeAutoSync = checked => {
  //   this.props.store.updateSyncSetting({
  //     autoSync: checked
  //   })
  // }

  getTokenCreateGuideUrl = () => {
    return syncTokenCreateUrls[this.props.syncType]
  }

  renderGistUrl = () => {
    if (!this.props.formData.url) {
      return null
    }
    return (
      <Link to={this.props.formData.url}>Check gist</Link>
    )
  }

  render () {
    const { getFieldDecorator } = this.props.form
    const {
      token,
      lastSyncTime = '',
      gistId
    } = this.props.formData
    const cls = this.state.hide ? 'hide' : ''
    const { syncType } = this.props
    const timeFormatted = lastSyncTime
      ? moment(lastSyncTime).format('YYYY-MM-DD HH:mm:ss')
      : '-'
    const tokenLabel = (
      <Tooltip
        title={
          <span>
            github personal access token
            <Link className='mg1l' to={this.getTokenCreateGuideUrl()} />
          </span>
        }
      >
        <span>
          token <Icon type='question-circle' />
        </span>
      </Tooltip>
    )
    return (
      <Form onSubmit={this.handleSubmit} className='form-wrap pd1x'>
        <FormItem
          {...formItemLayout}
          label={tokenLabel}
          hasFeedback
        >
          {getFieldDecorator('token', {
            rules: [{
              max: 100, message: '100 chars max'
            }, {
              required: true, message: syncType + ' access token required'
            }],
            initialValue: token
          })(
            <Input
              type='password'
              placeholder={syncType + ' personal access token'}
            />
          )}
        </FormItem>
        <FormItem {...tailFormItemLayout} className='sync-control'>
          <span className='pointer sync-control-link' onClick={this.showGistForm}>Use existing gist ID</span>
        </FormItem>
        <div className={cls}>
          <FormItem
            {...formItemLayout}
            label='gist ID'
          >
            {getFieldDecorator('gistId', {
              rules: [{
                max: 100, message: '100 chars max'
              }],
              initialValue: gistId
            })(
              <Input
                placeholder={syncType + ' gist id'}
              />
            )}
          </FormItem>
        </div>
        {/* <FormItem
          {...formItemLayout}
          label={ss('autoSync')}
        >
          <Switch
            checked={autoSync}
            disabled={this.disabled()}
            onChange={this.onChangeAutoSync}
          />
        </FormItem> */}
        <FormItem {...tailFormItemLayout}>
          <p>
            <Button
              type='ghost'
              className='mg1r'
              onClick={() => this.save()}
              icon='save'
            >{e('save')}</Button>
            {/* <Button
              type='ghost'
              onClick={this.sync}
              disabled={this.disabled()}
              className='mg1r'
              loading={isSyncingSetting}
              icon='swap'
            >{ss('sync')}</Button> */}
            <Button
              type='ghost'
              onClick={this.upload}
              disabled={this.disabled()}
              className='mg1r'
              icon='arrow-up'
            >{ss('uploadSettings')}</Button>
            <Button
              type='ghost'
              onClick={this.download}
              disabled={this.disabled()}
              className='mg1r'
              icon='arrow-down'
            >{ss('downloadSettings')}</Button>
          </p>
          <p>
            {e('lastSyncTime')}: {timeFormatted}
          </p>
          <p>
            {this.renderGistUrl()}
          </p>
        </FormItem>
      </Form>
    )
  }
}

@Form.create()
@validateFieldsAndScroll
class SyncFormExport extends SyncForm {}

export default SyncFormExport
