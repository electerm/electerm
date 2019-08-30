/**
 * setting sync panel，
 */

/**
 * bookmark form
 */
import React from 'react'
import {
  Form, Button, Input,
  Tooltip, Icon,
  Switch
} from 'antd'
import { validateFieldsAndScroll } from '../../common/dec-validate-and-scroll'
import { formItemLayout, tailFormItemLayout } from '../../common/form-layout'
import InputAutoFocus from '../common/input-auto-focus'
import Link from '../common/external-link'
import Gist from 'gist-wrapper'
import './bookmark-form.styl'

const FormItem = Form.Item
const { prefix } = window
const e = prefix('form')
const ss = prefix('settingSync')

export class SyncForm extends React.PureComponent {
  state = {
    submitting: false,
    syncing: false
  }

  disabled = () => {
    const {
      gistId,
      githubAccessToken
    } = this.props.formData
    return !!gistId && !!githubAccessToken
  }

  getClient = (githubAccessToken = this.props.formData.githubAccessToken) => {
    return this.client || new Gist(githubAccessToken)
  }

  getGist = async res => {
    const client = this.getClient(res.githubAccessToken)
    const gist = await client.getOne(res.gistId).catch(
      this.props.onError
    )
    if (gist) {
      this.client = client
    }
    return gist
  }

  submit = async () => {
    const res = await this.validateFieldsAndScroll()
    if (!res) {
      return
    }
    const gist = this.getGist(res)
    if (!gist) {
      return
    }
    if (this.isNew(gist)) {
      await this.upload(res)
    }
    res.lastSyncTime = Date.now()
    this.props.doSubmit(res)
  }

  doSubmit = res => {
    this.props.submit(res)
  }

  sync = () => {
    const { formData } = this.props
    const gist = this.getGist(formData)
    if (!gist) {
      return
    }
    const status = JSON.parse(gist.files['config.json'])
    if (status.lastSyncTime > formData.lastSyncTime || 0) {
      this.upload()
    } else {
      this.download()
    }
  }

  upload = async (conf = this.props.formData) => {
    const client = this.getClient(conf.githubAccessToken)
    if (!client) {
      return
    }
    await client.update(conf.gistId, {
      description: 'sync electerm data',
      files: {
        'status.json': {
          content: JSON.stringify({
            lastSyncTime: Date.now(),
            electermVersion: this.props.version
          }),
          filename: 'status.json'
        },
        'bookmarks.json': {
          content: JSON.stringify(this.props.bookmarks),
          filename: 'bookmarks.json'
        },
        'terminalThemes.json': {
          content: JSON.stringify(this.props.terminalThemes),
          filename: 'terminalThemes.json'
        },
        'userConfig.json': {
          content: JSON.stringify(this.props.userConfig),
          filename: 'userConfig.json'
        }
      }
    })
  }

  download = () => {

  }

  render () {
    const { getFieldDecorator } = this.props.form
    const {
      autofocustrigger
    } = this.props
    const {
      gistId,
      githubAccessToken,
      autoSync,
      lastSyncTime = ''
    } = this.props.formData
    const { submitting, syncing } = this.state
    const tokenLabel = (
      <Tooltip
        title={
          <span>
            github personal access token
            <Link className='mg1l' to='https://github.com/electerm/electerm/wiki/create-personal-access-token' />
          </span>
        }
      >
        <span>
          token <Icon type='question-circle' />
        </span>
      </Tooltip>
    )
    const gistIdLabel = (
      <Tooltip title={
        <span>
          secret gist id
          <Link className='mg1l' to='https://github.com/electerm/electerm/wiki/create-secret-gist' />
        </span>
      }>
        <span>
          gist id <Icon type='question-circle' />
        </span>
      </Tooltip>
    )
    return (
      <Form onSubmit={this.handleSubmit} className='form-wrap pd1x'>
        <FormItem
          {...formItemLayout}
          label={gistIdLabel}
          hasFeedback
        >
          {getFieldDecorator('gistId', {
            rules: [{
              max: 100, message: '100 chars max'
            }, {
              required: true, message: 'gistId required'
            }],
            initialValue: gistId
          })(
            <InputAutoFocus
              autofocustrigger={autofocustrigger}
              selectall='true'
              placeholder='gist id'
            />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={tokenLabel}
          hasFeedback
        >
          {getFieldDecorator('githubAccessToken', {
            rules: [{
              max: 100, message: '100 chars max'
            }, {
              required: true, message: 'githubAccessToken required'
            }],
            initialValue: githubAccessToken
          })(
            <Input
              type='password'
              placeholder='github personal access token'
            />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={ss('autoSync')}
        >
          {getFieldDecorator('autoSync', {
            initialValue: !!autoSync,
            valuePropName: 'checked'
          })(
            <Switch />
          )}
        </FormItem>
        <FormItem {...tailFormItemLayout}>
          <p>
            <Button
              type='ghost'
              className='mg1r'
              onClick={() => this.submit()}
              loading={submitting}
            >{e('save')}</Button>
            <Button
              type='ghost'
              onClick={this.sync}
              disabled={this.disabled()}
              className='mg1r'
              loading={syncing}
            >{ss('sync')}</Button>
            <Button
              type='ghost'
              onClick={this.upload}
              disabled={this.disabled()}
              className='mg1r'
              loading={syncing}
            >{ss('uploadSettings')}</Button>
            <Button
              type='ghost'
              onClick={this.download}
              disabled={this.disabled()}
              className='mg1r'
              loading={syncing}
            >{ss('downloadSettings')}</Button>
          </p>
          <p>
            {e('lastSyncTime')}: {lastSyncTime}
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
