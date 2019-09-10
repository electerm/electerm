
import { BookmarkForm } from '../bookmark-form'
import {
  Form, Button, Input,
  message, Switch
} from 'antd'
import { validateFieldsAndScroll } from '../../common/dec-validate-and-scroll'
import { generate } from 'shortid'
import InputAutoFocus from '../common/input-auto-focus'
import { settingMap } from '../../common/constants'

const { TextArea } = Input
const FormItem = Form.Item
const { prefix } = window
const e = prefix('form')
const s = prefix('setting')
const t = prefix('quickCommands')

@Form.create()
@validateFieldsAndScroll
class QuickCommandForm extends BookmarkForm {
  handleSubmit = async (evt) => {
    evt.preventDefault()
    const res = await this.validateFieldsAndScroll()
    if (!res) return
    const { formData } = this.props
    const {
      name,
      command,
      inputOnly
    } = res
    const update = {
      name,
      command,
      inputOnly
    }
    const update1 = {
      ...update,
      id: generate()
    }
    if (formData.id) {
      this.props.store.editItem(formData.id, update, settingMap.quickCommands)
    } else {
      this.props.store.addItem(update1, settingMap.quickCommands)
      this.props.store.modifier({
        settingItem: {
          id: '',
          name: t('newQuickCommand')
        }
      })
    }
    message.success(s('saved'))
  }

  render () {
    const { getFieldDecorator } = this.props.form
    const {
      command,
      name,
      inputOnly = false
    } = this.props.formData
    const { autofocustrigger } = this.props.store
    return (
      <Form onSubmit={this.handleSubmit} className='form-wrap pd2l' layout='vertical'>
        <FormItem
          label={t('quickCommandName')}
          hasFeedback
        >
          {getFieldDecorator('name', {
            rules: [{
              max: 30, message: '30 chars max'
            }, {
              required: true, message: 'name required'
            }],
            initialValue: name
          })(
            <InputAutoFocus
              selectall='true'
              autofocustrigger={autofocustrigger}
            />
          )}
        </FormItem>
        <FormItem
          label={t('quickCommand')}
        >
          {getFieldDecorator('command', {
            rules: [{
              max: 1000, message: '1000 chars max'
            }, {
              required: true, message: 'command required'
            }],
            initialValue: command
          })(
            <TextArea rows={3} />
          )}
        </FormItem>
        <FormItem
          label={s('inputOnly')}
        >
          {getFieldDecorator('inputOnly', {
            initialValue: inputOnly,
            valuePropName: 'checked'
          })(
            <Switch />
          )}
        </FormItem>
        <FormItem>
          <p>
            <Button
              type='ghost'
              onClick={this.handleSubmit}
            >{e('save')}</Button>
          </p>
        </FormItem>
      </Form>
    )
  }
}

export default QuickCommandForm
