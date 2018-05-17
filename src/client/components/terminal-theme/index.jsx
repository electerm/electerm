
import {SshForm} from '../ssh-form'
import {
  Form, Button, Input,
  //message,
  Upload
} from 'antd'
import {validateFieldsAndScroll} from '../../common/dec-validate-and-scroll'
import {convertTheme, convertThemeToText, exportTheme, defaultTheme} from '../../common/terminal-theme'
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
export default class ThemeForm extends SshForm {

  export = () => {
    exportTheme(this.state.formData.id)
  }

  handleSubmit = async (e, saveOnly = false) => {
    e.preventDefault()
    let res = await this.validateFieldsAndScroll()
    if (!res) return
    let {formData} = this.state
    let {
      themeName,
      themeText
    } = res
    let update = {
      name: themeName,
      themeConfig: convertTheme(themeText).themeConfig
    }
    let update1 = {
      ...update,
      id: generate()
    }
    if (formData.id) {
      this.props.editTheme(formData.id, update)
    } else {
      this.props.addTheme({
        ...update,
        id: generate()
      })
    }
    if (!saveOnly) {
      this.props.setTheme(
        formData.id || update1.id
      )
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
      themeConfig,
      id,
      name: themeName
    } = this.state.formData
    let themeText = convertThemeToText({themeConfig, name})
    let isDefaultTheme = id === defaultTheme.id
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
            <Input disabled={isDefaultTheme} />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('themeConfig')}
        >
          {getFieldDecorator('themeText', {
            rules: [{
              max: 1000, message: '1000 chars max'
            }, {
              required: true, message: 'theme Config required'
            }],
            initialValue: themeText
          })(
            <TextArea rows={18} disabled={isDefaultTheme} />
          )}
          <div className="pd1t">
            <Upload
              beforeUpload={this.beforeUpload}
              fileList={[]}
              className="mg1b"
            >
              <Button
                type="ghost"
                disabled={isDefaultTheme}
              >
                {e('importFromFile')}
              </Button>
            </Upload>
            {
              id
                ? (
                  <Button
                    type="ghost"
                    onClick={this.export}
                  >
                    {e('export')}
                  </Button>
                )
                : null
            }
          </div>
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
              onClick={e => this.handleSubmit(e, true)}
            >{e('save')}</Button>
          </p>
        </FormItem>
      </Form>
    )
  }

}
