import {
  Form,
  InputNumber,
  Input,
  Radio,
  Button,
  Table
} from 'antd'
import {
  formItemLayout,
  tailFormItemLayout
} from '../../common/form-layout'
import {
  MinusCircleFilled,
  PlusOutlined
} from '@ant-design/icons'
import RenderAuth from './render-auth-ssh'
import uid from '../../common/uid'
import {
  authTypeMap,
  connectionHoppingWarnKey
} from '../../common/constants'
import { useState } from 'react'
import ConnectionHoppingWarningText from '../common/connection-hopping-warning-text'
import BookmarkSelect from './bookmark-select'
import * as ls from '../../common/safe-local-storage'

const FormItem = Form.Item
const RadioButton = Radio.Button
const RadioGroup = Radio.Group
const e = window.translate

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
  const [showWarn, setShowWarn] = useState(
    window.store.hasOldConnectionHoppingBookmark && ls.getItem(connectionHoppingWarnKey) !== 'yes'
  )
  function closeWarn () {
    setShowWarn(false)
  }
  const [list, setList] = useState(formData.connectionHoppings || [])
  function onChangeAuthType (e) {
    editState(old => {
      return {
        ...old,
        authType: e.target.value
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
  const authTypes = props.authTypes || Object.keys(authTypeMap).map(k => {
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
      title: e('connectionHopping'),
      key: 'connectionHopping',
      render: (k, item) => {
        const pass = item.password ? ':*****' : ''
        const ph = item.passphase ? '(passphase:*****)' : ''
        const pk = item.privateKey ? '(privateKey:*****)' : ''
        const useProfile = item.profile ? '[profile] ' : ''
        return <span>{useProfile}{item.username}{pass}@{item.host}:{item.port}{pk}{ph}</span>
      }
    }, {
      title: e('del'),
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

  function renderPaths () {
    return [
      '👤',
      ...list.map(d => d.host),
      form.getFieldValue('host')
    ].join(' -> ')
  }

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
        {renderPaths()}
      </FormItem>
    )
  }
  function renderWarn () {
    if (!showWarn) {
      return null
    }
    return (
      <FormItem {...tailFormItemLayout}>
        <ConnectionHoppingWarningText closeWarn={closeWarn} />
      </FormItem>
    )
  }
  const treeProps = {
    bookmarks: store.bookmarks.filter(d => {
      return d.host && d.port && d.username
    }),
    bookmarkGroups: store.bookmarkGroups,
    onSelect: handleFinish
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
        {renderWarn()}
        <FormItem
          {...formItemLayout}
          label={e('chooseFromBookmarks')}
          className='mg60b'
        >
          <BookmarkSelect {...treeProps} />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('host')}
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
          label={e('port')}
          hasFeedback
          name='port'
          rules={[{
            required: true, message: 'port required'
          }]}
        >
          <InputNumber
            placeholder={e('port')}
            min={1}
            max={65535}
            step={1}
          />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('username')}
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
                    {e(t)}
                  </RadioButton>
                )
              })
            }
          </RadioGroup>
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
            {e('connectionHopping')}
          </Button>
        </FormItem>
      </Form>
    </div>
  )
}
