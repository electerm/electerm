import { Button, Input, Switch, Form, message, Select } from 'antd'
import copy from 'json-deep-copy'
import generate from '../../common/uid'
import InputAutoFocus from '../common/input-auto-focus'
const { TextArea } = Input
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
      command,
      inputOnly,
      labels
    } = res
    const update = copy({
      name,
      command,
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
          required: true, message: 'name required'
        }]}
        hasFeedback
        name='name'
      >
        <InputAutoFocus
          selectall='yes'
          autofocustrigger={autofocustrigger}
        />
      </FormItem>
      <FormItem
        name='command'
        label={t('quickCommand')}
        rules={[{
          max: 5000, message: '5000 chars max'
        }, {
          required: true, message: 'command required'
        }]}
      >
        <TextArea rows={3} />
      </FormItem>
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
            type='dashed'
            htmlType='submit'
          >{e('save')}
          </Button>
        </p>
      </FormItem>
    </Form>
  )
}
