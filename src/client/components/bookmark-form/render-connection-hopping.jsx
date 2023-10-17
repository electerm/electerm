import {
  Form,
  InputNumber,
  Input,
  Radio,
  Button,
  Table
} from 'antd'
import { formItemLayout, tailFormItemLayout } from '../../common/form-layout'
import {
  MinusCircleFilled,
  PlusOutlined
} from '@ant-design/icons'
import RenderAuth from './render-auth-ssh'
import uid from '../../common/uid'
import {
  authTypeMap
} from '../../common/constants'
import { useState } from 'react'

const FormItem = Form.Item
const RadioButton = Radio.Button
const RadioGroup = Radio.Group
const { prefix } = window
const f = prefix('form')
const m = prefix('menu')

export default function renderConnectionHopping (props) {
  const {
    store,
    form,
    formData
  } = props
  const [formChild] = Form.useForm()
  const [initialValues, editState] = useState({
    port: 22,
    authType: authTypeMap.password
  })
  const [list, setList] = useState(formData.connectionHoppings || [])
  function onChangeAuthType (authType) {
    editState(old => {
      return {
        ...old,
        authType
      }
    })
  }
  function onSubmit () {
    formChild.submit()
  }
  function handleFinish (data) {
    const nd = {
      ...data,
      id: uid()
    }
    const v = [
      ...form.getFieldValue('connectionHoppings'),
      nd
    ]
    form.setFieldsValue({
      connectionHoppings: v
    })
    setList(old => {
      return [
        ...old,
        data
      ]
    })
    formChild.resetFields()
  }
  const authTypes = Object.keys(authTypeMap).map(k => {
    return k
  })

  function remove (id) {
    setList(old => {
      return old.filter(i => i.id !== id)
    })
    const v = form.getFieldValue('connectionHoppings').filter(i => i.id !== id)
    form.setFieldsValue({
      connectionHoppings: v
    })
    formChild.resetFields()
  }
  const cols = [
    {
      title: 'NO.',
      dataIndex: 'index',
      key: 'index',
      render: (k) => k
    }, {
      title: f('connectionHopping'),
      key: 'connectionHopping',
      render: (k, item) => {
        const pass = item.password ? ':*****' : ''
        const ph = item.passphase ? '(passphase:*****)' : ''
        const pk = item.privateKey ? '(privateKey:*****)' : ''
        return <span>{item.username}{pass}@{item.host}:{item.port}{pk}{ph}</span>
      }
    }, {
      title: m('del'),
      key: 'op',
      dataIndex: 'id',
      render: (id) => {
        return (
          <MinusCircleFilled
            className='pointer'
            onClick={() => remove(id)}
          />
        )
      }
    }
  ]

  function renderList () {
    return (
      <FormItem {...tailFormItemLayout}>
        <Table
          columns={cols}
          className='mg3b'
          pagination={false}
          size='small'
          dataSource={list.map((d, i) => {
            return {
              ...d,
              index: i + 1
            }
          })}
        />
      </FormItem>
    )
  }

  return (
    <div>
      <FormItem
        name='connectionHoppings'
        className='hide'
      >
        <Input />
      </FormItem>
      <Form
        form={formChild}
        onFinish={handleFinish}
        initialValues={initialValues}
      >
        {renderList()}
        <FormItem
          {...formItemLayout}
          label={f('host')}
          hasFeedback
          rules={[{
            max: 520, message: '520 chars max'
          }, {
            required: true, message: 'host required'
          }]}
          normalize={props.trim}
          name='host'
        >
          <Input />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={f('username')}
          hasFeedback
          name='username'
          rules={[{
            max: 128, message: '128 chars max'
          }]}
          normalize={props.trim}
        >
          <Input />
        </FormItem>
        <FormItem
          {...tailFormItemLayout}
          className='mg1b'
          name='authType'
        >
          <RadioGroup
            size='small'
            onChange={onChangeAuthType}
            buttonStyle='solid'
          >
            {
              authTypes.map(t => {
                return (
                  <RadioButton value={t} key={t}>
                    {f(t)}
                  </RadioButton>
                )
              })
            }
          </RadioGroup>
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={f('port')}
          hasFeedback
          name='port'
          rules={[{
            required: true, message: 'port required'
          }]}
        >
          <InputNumber
            placeholder={f('port')}
            min={1}
            max={65535}
            step={1}
          />
        </FormItem>
        <RenderAuth
          form={formChild}
          store={store}
          authType={initialValues.authType}
        />
        <FormItem {...tailFormItemLayout} className='mg60b'>
          <Button
            type='default'
            htmlType='button'
            icon={<PlusOutlined />}
            onClick={onSubmit}
          >
            {f('connectionHopping')}
          </Button>
        </FormItem>
      </Form>
    </div>
  )
}
