import { Button, Switch, Form, message, Select } from 'antd'
import copy from 'json-deep-copy'
import generate from '../../common/uid'
import InputAutoFocus from '../common/input-auto-focus'
import renderQm from './quick-commands-list-form'
const FormItem = Form.Item
const { Option } = Select
const { prefix } = window
const e = prefix('form')
const t = prefix('quickCommands')
const s = prefix('setting')

export default function QuickCommandForm (props) {
  const [form] = Form.useForm()
  const { autofocustrigger, quickCommandTags = [] } = props.store
  async function handleSubmit (res) {
    const { formData } = props
    const {
      name,
      commands,
      inputOnly,
      labels
    } = res
    const update = copy({
      name,
      commands,
      inputOnly,
      labels
    })
    const update1 = {
      ...update,
      id: generate()
    }
    if (formData.id) {
      props.store.editQuickCommand(formData.id, update)
    } else {
      props.store.addQuickCommand(update1)
      props.store.setSettingItem({
        id: '',
        name: t('newQuickCommand')
      })
    }
    message.success(s('saved'))
  }
  const initialValues = props.formData
  if (!initialValues.labels) {
    initialValues.labels = []
  }
  if (!initialValues.commands) {
    initialValues.commands = [{
      command: initialValues.command || '',
      id: generate(),
      delay: 100
    }]
  }
  return (
    <Form
      form={form}
      onFinish={handleSubmit}
      className='form-wrap pd2l'
      layout='vertical'
      initialValues={initialValues}
    >
      <FormItem
        label={t('quickCommandName')}
        rules={[{
          max: 60, message: '60 chars max'
        }, {
          required: true, message: 'Name required'
        }]}
        hasFeedback
        name='name'
      >
        <InputAutoFocus
          selectall='yes'
          autofocustrigger={autofocustrigger}
        />
      </FormItem>
      {renderQm()}
      <FormItem
        name='labels'
        label={t('label')}
      >
        <Select
          mode='tags'
        >
          {
            quickCommandTags.map(q => {
              return (
                <Option value={q} key={'qmt-' + q}>
                  {q}
                </Option>
              )
            })
          }
        </Select>
      </FormItem>
      <FormItem
        label={t('inputOnly')}
        name='inputOnly'
        valuePropName='checked'
      >
        <Switch />
      </FormItem>
      <FormItem>
        <p>
          <Button
            type='primary'
            htmlType='submit'
          >{e('save')}
          </Button>
        </p>
      </FormItem>
    </Form>
  )
}
