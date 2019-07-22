
import { BookmarkForm } from '../bookmark-form'
import {
  Form, Button, Input,
  message,
  Upload
} from 'antd'
import { validateFieldsAndScroll } from '../../common/dec-validate-and-scroll'
import { convertTheme, convertThemeToText, exportTheme, defaultTheme } from '../../common/terminal-theme'
import { generate } from 'shortid'
import { formItemLayout, tailFormItemLayout } from '../../common/form-layout'
import InputAutoFocus from '../common/input-auto-focus'

const { TextArea } = Input
const FormItem = Form.Item
const { prefix } = window
const e = prefix('form')
const s = prefix('setting')
const t = prefix('terminalThemes')

@Form.create()
@validateFieldsAndScroll
class ThemeForm extends BookmarkForm {
  export = () => {
    exportTheme(this.props.formData.id)
  }

  handleSubmit = async (e, saveOnly = false) => {
    e.preventDefault()
    const res = await this.validateFieldsAndScroll()
    if (!res) return
    const { formData } = this.props
    const {
      themeName,
      themeText
    } = res
    const update = {
      name: themeName,
      themeConfig: convertTheme(themeText).themeConfig
    }
    const update1 = {
      ...update,
      id: generate()
    }
    if (formData.id) {
      this.props.store.editTheme(formData.id, update)
    } else {
      this.props.store.addTheme(update1)
      this.props.store.modifier({
        item: update1
      })
    }
    if (!saveOnly) {
      this.props.store.setTheme(
        formData.id || update1.id
      )
    }
    message.success(s('saved'))
  }

  beforeUpload = (file) => {
    const txt = window.getGlobal('fs')
      .readFileSync(file.path).toString()
    const { name, themeConfig } = convertTheme(txt)
    this.props.form.setFieldsValue({
      themeName: name,
      themeText: convertThemeToText({
        name, themeConfig
      })
    })
    return false
  }

  render () {
    const { getFieldDecorator } = this.props.form
    const {
      themeConfig,
      id,
      name: themeName
    } = this.props.formData
    const { autofocustrigger } = this.props.store
    const themeText = convertThemeToText({ themeConfig, name: themeName })
    const isDefaultTheme = id === defaultTheme.id
    return (
      <Form onSubmit={this.handleSubmit} className='form-wrap'>
        <FormItem {...tailFormItemLayout}>
          {
            id
              ? (
                <Button
                  type='ghost'
                  onClick={this.export}
                >{t('export')}</Button>
              )
              : null
          }
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={t('themeName')}
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
            <InputAutoFocus selectall='true' disabled={isDefaultTheme} autofocustrigger={autofocustrigger} />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={t('themeConfig')}
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
          <div className='pd1t'>
            <Upload
              beforeUpload={this.beforeUpload}
              fileList={[]}
              className='mg1b'
            >
              <Button
                type='ghost'
                disabled={isDefaultTheme}
              >
                {e('importFromFile')}
              </Button>
            </Upload>
          </div>
        </FormItem>
        {
          isDefaultTheme
            ? null
            : (
              <FormItem {...tailFormItemLayout}>
                <p>
                  <Button
                    type='primary'
                    htmlType='submit'
                    className='mg1r'
                  >{t('saveAndApply')}</Button>
                  <Button
                    type='ghost'
                    onClick={e => this.handleSubmit(e, true)}
                  >{e('save')}</Button>
                </p>
              </FormItem>
            )
        }
      </Form>
    )
  }
}

export default ThemeForm
