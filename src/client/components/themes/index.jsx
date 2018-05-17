
import React from 'react'
import {
  Form, Button, Input//,
  //message,
  //Upload
} from 'antd'
import {validateFieldsAndScroll} from '../../common/dec-validate-and-scroll'
import {convertTheme, convertThemeToText} from '../../common/terminal-theme'
import _ from 'lodash'
import copy from 'json-deep-copy'
import {generate} from 'shortid'
import {formItemLayout, tailFormItemLayout} from '../../common/form-layout'

const {TextArea} = Input
const FormItem = Form.Item
const {prefix} = window
const e = prefix('form')

@Form.create()
@validateFieldsAndScroll
export default class ThemeForm extends React.Component {

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

  beforeUpload = (file) => {
    let txt = window.getGlobal('fs')
      .readFileSync(file.path).toString()
    let {name, themeConfig} = convertTheme(txt)
    this.props.form.setFieldsValue({
      themeName: name,
      themeText: convertThemeToText({
        name, themeConfig
      })
    })
    return false
  }

  render() {
    const {getFieldDecorator} = this.props.form
    const {
      themeText,
      themeName
    } = this.state.formData

    return (
      <Form onSubmit={this.handleSubmit} className="form-wrap">
        <FormItem
          {...formItemLayout}
          label={e('name')}
          hasFeedback
        >
          {getFieldDecorator('themeName', {
            rules: [{
              max: 30, message: '30 chars max'
            }, {
              required: true, message: 'theme name required'
            }],
            initialValue: themeName
          })(
            <Input />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('themeConfig')}
          hasFeedback
        >
          {getFieldDecorator('themeText', {
            rules: [{
              max: 1000, message: '1000 chars max'
            }, {
              required: true, message: 'theme Config required'
            }],
            initialValue: themeText
          })(
            <TextArea rows={18} />
          )}
        </FormItem>

        <FormItem {...tailFormItemLayout}>
          <p>
            <Button
              type="primary"
              htmlType="submit"
              className="mg1r"
            >{e('saveAndApply')}</Button>
            <Button
              type="ghost"
              className="mg1r"
              onClick={() => this.handleSubmit('save')}
            >{e('save')}</Button>
          </p>
        </FormItem>
      </Form>
    )
  }

}
