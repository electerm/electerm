/**
 * default text editor for remote file
 */

import React from 'react'
import {
  Form, Button, Input,
  Spin,
  Modal
} from 'antd'
import {validateFieldsAndScroll} from '../../common/dec-validate-and-scroll'
import resolve from '../../common/resolve'

const FormItem = Form.Item
const {prefix} = window
const e = prefix('form')
const c = prefix('common')

export class TextEditorForm extends React.PureComponent {

  state = {
    text: '',
    path: 'loading...',
    loading: true
  }

  componentDidMount() {
    if (this.props.visible) {
      this.fetchText()
    }
  }

  fetchText = async () => {
    this.setState({
      loading: true
    })
    let {
      sftp,
      file: {
        path,
        name
      }
    } = this.props
    let p = resolve(path, name)
    this.setState({
      path: p
    })
    let text = await sftp.readFile(p)
    this.setState({
      text: text || '',
      loading: false
    }, this.props.form.reset)
  }

  handleSubmit = async (evt) => {
    evt.preventDefault()
    let res = await this.validateFieldsAndScroll()
    if (!res) {
      return
    }
    this.setState({
      loading: true
    })
    if (res.text === this.state.text) {
      return this.cancel()
    }
    let r = await this.props.sftp.writeFile(
      this.state.path,
      res.text
    )
    this.cancel()
    r && this.props.afterWrite()
  }

  cancel = () => {
    this.props.modifier({
      textEditorProps: {}
    })
  }

  renderForm() {
    const {
      text
    } = this.state
    const {getFieldDecorator} = this.props.form
    return (
      <Form
        onSubmit={this.handleSubmit}
        className="form-wrap pd1x"
        layout="vertical"
      >
        <FormItem
          label={e('loginScript')}
          hasFeedback
        >
          {getFieldDecorator('text', {
            initialValue: text
          })(
            <Input.TextArea rows={10}>{text}</Input.TextArea>
          )}
        </FormItem>
      </Form>
    )
  }

  renderFooter() {
    return (
      <div>
        <Button
          type="primary"
          className="mg1r"
          onClick={this.handleSubmit}
        >{e('save')}</Button>
        <Button
          type="ghost"
          className="mg1r"
          onClick={this.props.form.reset}
        >{e('reset')}</Button>
        <Button
          type="ghost"
          onClick={this.cancel}
          className="mg2r"
        >{c('cancel')}</Button>
      </div>
    )
  }

  render() {
    const {visible} = this.props
    if (!visible) {
      return null
    }
    const {path, loading} = this.state
    let props = {
      footer: this.renderFooter(),
      title: path,
      maskClosable: false,
      onCancel: this.cancel,
      visible
    }
    return (
      <Modal
        {...props}
      >
        <Spin spinning={loading}>
          {this.renderForm()}
        </Spin>
      </Modal>
    )
  }

}

@Form.create()
@validateFieldsAndScroll
class TextEditor extends TextEditorForm {}

export default TextEditor
