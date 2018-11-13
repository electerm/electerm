/**
 * default text editor for remote file
 */

import {Component} from '../common/react-subx'
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
const s = prefix('sftp')

export class TextEditorForm extends Component {

  state = {
    text: '',
    path: 'loading...',
    loading: true
  }

  componentDidMount() {
    if (this.props.store.textEditorProps.visible) {
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
    }, this.props.form.resetFields)
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
    r && this.props.textEditorProps.afterWrite()
    this.cancel()
  }

  cancel = () => {
    this.props.store.modifier({
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
        layout="vertical"
      >
        <FormItem>
          {getFieldDecorator('text', {
            initialValue: text
          })(
            <Input.TextArea rows={20}>{text}</Input.TextArea>
          )}
        </FormItem>
      </Form>
    )
  }

  renderFooter() {
    let {loading} = this.state
    return (
      <div>
        <Button
          type="primary"
          className="mg1r"
          disabled={loading}
          onClick={this.handleSubmit}
        >{e('save')}</Button>
        <Button
          type="ghost"
          className="mg1r"
          disabled={loading}
          onClick={() => this.props.form.resetFields()}
        >{s('reset')}</Button>
        <Button
          type="ghost"
          onClick={this.cancel}
          disabled={loading}
          className="mg2r"
        >{c('cancel')}</Button>
      </div>
    )
  }

  render() {
    const {visible} = this.props.store.textEditorProps
    if (!visible) {
      return null
    }
    const {path, loading} = this.state
    const title = `${s('edit')} ${s('remote')} ${s('file')}: ${path}`
    let props = {
      footer: this.renderFooter(),
      title,
      maskClosable: false,
      onCancel: this.cancel,
      width: '90%',
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
