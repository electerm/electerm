import {
  Form,
  InputNumber,
  Input,
  Radio,
  Button
} from 'antd'
import {
  formItemLayout,
  tailFormItemLayout
} from '../../../common/form-layout'
import {
  PlusOutlined,
  SaveOutlined
} from '@ant-design/icons'
import RenderAuth from './render-auth-ssh'
import {
  authTypeMap
} from '../../../common/constants'
import { useState } from 'react'
import BookmarkSelect from './bookmark-select'

const FormItem = Form.Item
const RadioButton = Radio.Button
const RadioGroup = Radio.Group
const e = window.translate

export default function ConnectionHoppingForm (props) {
  const {
    store,
    formChild,
    initialValues,
    onFinish,
    authTypes: authTypesProp,
    trim,
    isEdit
  } = props
  const [authType, setAuthType] = useState(initialValues.authType || authTypeMap.password)

  function onChangeAuthType (e) {
    setAuthType(e.target.value)
  }

  function onSubmit () {
    formChild.submit()
  }

  const authTypes = authTypesProp || Object.keys(authTypeMap).map(k => k)

  const treeProps = {
    bookmarks: store.bookmarks.filter(d => {
      return d.host && d.port && d.username
    }),
    bookmarkGroups: store.bookmarkGroups,
    onSelect: onFinish
  }

  return (
    <Form
      form={formChild}
      onFinish={onFinish}
      initialValues={initialValues}
      component='div'
    >
      <FormItem
        {...formItemLayout}
        label={e('chooseFromBookmarks')}
        className='mg60b'
        style={{ display: isEdit ? 'none' : '' }}
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
        normalize={trim}
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
        normalize={trim}
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
        authType={authType}
      />
      <FormItem {...tailFormItemLayout} className='mg60b'>
        <Button
          type='default'
          htmlType='button'
          icon={isEdit ? <SaveOutlined /> : <PlusOutlined />}
          onClick={onSubmit}
        >
          {isEdit ? e('save') : e('connectionHopping')}
        </Button>
      </FormItem>
    </Form>
  )
}
