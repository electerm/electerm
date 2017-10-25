
import React from 'react'
import {Form, Button, Input, InputNumber} from 'antd'
import {validateFieldsAndScroll} from '../../common/dec-validate-and-scroll'
import _ from 'lodash'
import copy from 'json-deep-copy'
import {generate} from 'shortid'

const FormItem = Form.Item
const formItemLayout = {
  labelCol: {
    xs: { span: 24 },
    sm: { span: 6 }
  },
  wrapperCol: {
    xs: { span: 24 },
    sm: { span: 14 }
  }
}
const tailFormItemLayout = {
  wrapperCol: {
    xs: {
      span: 24,
      offset: 0
    },
    sm: {
      span: 14,
      offset: 6
    }
  }
}

@Form.create()
@validateFieldsAndScroll
export default class SshForm extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      formData: props.formData || {}
    }
  }

  componentWillReceiveProps(nextProps) {
    if (!_.isEqual(nextProps.formData, this.props.formData)) {
      this.setState({
        formData: copy(nextProps.formData)
      }, this.reset)
    }
  }

  submit = (item, type = this.props.type) => {
    let obj = item
    let {addItem, editItem} = this.props
    if (type === 'history') {
      obj.id = generate()
      addItem(obj, 'bookmarks')
      return
    }
    if (obj.id) {
      let tar = copy(obj)
      delete tar.id
      editItem(obj.id, tar, 'bookmarks')
    } else {
      obj.id = generate()
      addItem(obj, 'history')
      addItem(obj, 'bookmarks')
    }
  }

  reset = () => {
    this.props.form.resetFields()
  }

  handleSubmit = async (e) => {
    e && e.preventDefault && e.preventDefault()
    let res = await this.validateFieldsAndScroll()
    if (!res) return
    let obj = {
      ...this.state.formData,
      ...res
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

  render() {
    const {getFieldDecorator} = this.props.form
    const {host, port = 22, password, title, username} = this.state.formData
    return (
      <Form onSubmit={this.handleSubmit} className="form-wrap">
        <FormItem
          {...formItemLayout}
          label="host"
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
            <Input />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label="username"
          hasFeedback
        >
          {getFieldDecorator('username', {
            rules: [{
              max: 30, message: '30 chars max'
            }, {
              required: true, message: 'username required'
            }],
            initialValue: username
          })(
            <Input />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label="password"
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
              placeholder="password"
            />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label="port"
          hasFeedback
        >
          {getFieldDecorator('port', {
            rules: [{
              required: true, message: 'port required'
            }],
            initialValue: port
          })(
            <InputNumber
              placeholder="port"
              min={1}
              max={65535}
              step={1}
            />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label="title"
          hasFeedback
        >
          {getFieldDecorator('title', {
            initialValue: title
          })(
            <Input />
          )}
        </FormItem>
        <FormItem {...tailFormItemLayout}>
          <Button type="primary" htmlType="submit" className="mg1r">save and connect</Button>
          <Button
            type="primary"
            className="mg1r"
            onClick={() => this.handleSubmit('save')}
          >save</Button>
          <Button type="primary" onClick={this.handleSubmit}>connect</Button>
        </FormItem>
      </Form>
    )
  }

}
