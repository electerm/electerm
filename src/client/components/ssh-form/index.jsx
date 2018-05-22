
import React from 'react'
import {
  Form, Button, Input,
  InputNumber, message,
  Radio, Upload
} from 'antd'
import {validateFieldsAndScroll} from '../../common/dec-validate-and-scroll'
import _ from 'lodash'
import copy from 'json-deep-copy'
import {generate} from 'shortid'
import {authTypeMap, settingMap, defaultUserName} from '../../common/constants'
import {formItemLayout, tailFormItemLayout} from '../../common/form-layout'
import InputAutoFocus from '../common/input-auto-focus'

const {TextArea} = Input
const authTypes = Object.keys(authTypeMap).map(k => {
  return k
})
const RadioButton = Radio.Button
const RadioGroup = Radio.Group
const FormItem = Form.Item
const {prefix} = window
const e = prefix('form')

export class SshForm extends React.Component {

  componentWillReceiveProps(nextProps) {
    if (!_.isEqual(nextProps.formData, this.props.formData)) {
      this.reset()
    }
  }

  submit = (item, type = this.props.type) => {
    let obj = item
    let {addItem, editItem} = this.props
    if (type === settingMap.history) {
      obj.id = generate()
      delete obj.type
      addItem(obj, settingMap.bookmarks)
      return
    }
    if (obj.id) {
      let tar = copy(obj)
      delete tar.id
      editItem(obj.id, tar, settingMap.bookmarks)
    } else {
      obj.id = generate()
      addItem(obj, settingMap.history)
      addItem(obj, settingMap.bookmarks)
    }
  }

  test = async (options) => {
    let testConnection = window.getGlobal('testConnection')
    let msg = ''
    let res = await testConnection(options)
      .then(() => true)
      .catch((e) => {
        msg = e.message
        return false
      })
    if (res) {
      message.success('connection ok')
    } else {
      let err = 'connection fails' +
        (msg ? `: ${msg}` : '')
      message.error(err)
    }
  }

  reset = () => {
    this.props.form.resetFields()
  }

  handleSubmit = async (e, isTest = false) => {
    e && e.preventDefault && e.preventDefault()
    let res = await this.validateFieldsAndScroll()
    if (!res) return
    let obj = {
      ...this.props.formData,
      ...res
    }
    if (isTest) {
      return await this.test(obj)
    }
    e && this.submit(obj)
    if (e !== 'save') {
      this.props.addTab({
        ...res,
        id: generate()
      })
      this.props.hide()
    }
  }

  beforeUpload = (file) => {
    let privateKey = window.getGlobal('fs')
      .readFileSync(file.path).toString()
    this.props.form.setFieldsValue({
      privateKey
    })
    return false
  }

  renderAuth() {
    let authType = this.props.form.getFieldValue('authType')
      || authTypeMap.password
    return this[authType + 'Render']()
  }

  passwordRender() {
    const {getFieldDecorator} = this.props.form
    const {
      password
    } = this.props.formData
    return (
      <FormItem
        {...formItemLayout}
        label={e('password')}
        hasFeedback
      >
        {getFieldDecorator('password', {
          rules: [{
            max: 40, message: '40 chars max'
          }],
          initialValue: password
        })(
          <Input
            type="password"
            placeholder={e('password')}
          />
        )}
      </FormItem>
    )
  }

  privateKeyRender() {
    const {getFieldDecorator} = this.props.form
    const {
      privateKey,
      passphrase
    } = this.state.props
    return [
      <FormItem
        {...formItemLayout}
        label={e('privateKey')}
        hasFeedback
        key="privateKey"
        className="mg1b"
      >
        {getFieldDecorator('privateKey', {
          rules: [{
            max: 13000, message: '13000 chars max'
          }],
          initialValue: privateKey
        })(
          <TextArea
            placeholder={e('privateKeyDesc')}
            rows={2}
          />
        )}
        <Upload
          beforeUpload={this.beforeUpload}
          fileList={[]}
          className="mg1b"
        >
          <Button
            type="ghost"
          >
            {e('importFromFile')}
          </Button>
        </Upload>
      </FormItem>,
      <FormItem
        key="passphrase"
        {...formItemLayout}
        label={e('passphrase')}
        hasFeedback
      >
        {getFieldDecorator('passphrase', {
          rules: [{
            max: 100, message: '100 chars max'
          }],
          initialValue: passphrase
        })(
          <Input
            type="password"
            placeholder={e('passphraseDesc')}
          />
        )}
      </FormItem>
    ]
  }

  render() {
    const {getFieldDecorator} = this.props.form
    const {
      host,
      port = 22,
      title,
      authType = authTypeMap.password,
      username
    } = this.props.formData

    return (
      <Form onSubmit={this.handleSubmit} className="form-wrap">
        <FormItem
          {...formItemLayout}
          label={e('host')}
          hasFeedback
        >
          {getFieldDecorator('host', {
            rules: [{
              max: 130, message: '130 chars max'
            }, {
              required: true, message: 'host required'
            }],
            initialValue: host
          })(
            <InputAutoFocus selectAll />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('username')}
          hasFeedback
        >
          {getFieldDecorator('username', {
            rules: [{
              max: 30, message: '30 chars max'
            }, {
              required: true, message: 'username required'
            }],
            initialValue: username || defaultUserName
          })(
            <Input />
          )}
        </FormItem>
        <FormItem {...tailFormItemLayout} className="mg1b">
          {getFieldDecorator('authType', {
            initialValue: authType
          })(
            <RadioGroup size="small">
              {
                authTypes.map(t => {
                  return (
                    <RadioButton value={t} key={t}>
                      {e(t)}
                    </RadioButton>
                  )
                })
              }
            </RadioGroup>
          )}
        </FormItem>
        {this.renderAuth()}
        <FormItem
          {...formItemLayout}
          label={e('port')}
          hasFeedback
        >
          {getFieldDecorator('port', {
            rules: [{
              required: true, message: 'port required'
            }],
            initialValue: port
          })(
            <InputNumber
              placeholder={e('port')}
              min={1}
              max={65535}
              step={1}
            />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('title')}
          hasFeedback
        >
          {getFieldDecorator('title', {
            initialValue: title
          })(
            <Input />
          )}
        </FormItem>
        <FormItem {...tailFormItemLayout}>
          <p>
            <Button
              type="primary"
              htmlType="submit"
              className="mg1r"
            >{e('saveAndConnect')}</Button>
            <Button
              type="ghost"
              className="mg1r"
              onClick={() => this.handleSubmit('save')}
            >{e('save')}</Button>
            <Button
              type="ghost"
              onClick={this.handleSubmit}
              className="mg2r"
            >{e('connect')}</Button>
          </p>
          <p>
            <Button
              type="ghost"
              onClick={e => this.handleSubmit(e, true)}
            >{e('testConnection')}</Button>
          </p>
        </FormItem>
      </Form>
    )
  }

}

@Form.create()
@validateFieldsAndScroll
export default class SshFormExport extends SshForm {}

