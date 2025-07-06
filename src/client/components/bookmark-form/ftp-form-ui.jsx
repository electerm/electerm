/**
 * web form
 */

import { useEffect } from 'react'
import {
  Input,
  Form,
  InputNumber,
  TreeSelect,
  Switch
} from 'antd'
import { formItemLayout } from '../../common/form-layout'
import {
  newBookmarkIdPrefix,
  terminalFtpType
} from '../../common/constants'
import useSubmit from './use-submit'
import copy from 'json-deep-copy'
import { defaults, isEmpty } from 'lodash-es'
import { ColorPickerItem } from './color-picker-item.jsx'
import { getRandomDefaultColor } from '../../common/rand-hex-color.js'
import formatBookmarkGroups from './bookmark-group-tree-format'
import findBookmarkGroupId from '../../common/find-bookmark-group-id'
import ProfileItem from './profile-form-item'

const FormItem = Form.Item
const e = window.translate

export default function FtpFormUi (props) {
  const [
    form,
    handleFinish,
    submitUi
  ] = useSubmit(props)
  useEffect(() => {
    if (props.formData.id.startsWith(newBookmarkIdPrefix)) {
      form.setFieldsValue({
        category: props.currentBookmarkGroupId
      })
    }
  }, [props.currentBookmarkGroupId])
  const {
    id = ''
  } = props.formData
  const {
    bookmarkGroups = [],
    currentBookmarkGroupId
  } = props
  let initialValues = copy(props.formData)
  const initBookmarkGroupId = !id.startsWith(newBookmarkIdPrefix)
    ? findBookmarkGroupId(bookmarkGroups, id)
    : currentBookmarkGroupId
  const defaultValues = {
    type: terminalFtpType,
    port: 21,
    category: initBookmarkGroupId,
    color: getRandomDefaultColor(),
    user: '',
    password: '',
    secure: false
  }
  initialValues = defaults(initialValues, defaultValues)

  function renderCommon () {
    const {
      bookmarkGroups = []
    } = props
    const tree = formatBookmarkGroups(bookmarkGroups)
    return (
      <div className='pd1x'>
        <FormItem
          {...formItemLayout}
          label={e('title')}
          hasFeedback
        >
          <FormItem noStyle name='title'>
            <Input addonBefore={<ColorPickerItem />} />
          </FormItem>
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('host')}
          hasFeedback
          name='host'
          required
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
        <ProfileItem
          store={props.store}
          profileFilter={d => !isEmpty(d.vnc)}
        />
        <FormItem
          {...formItemLayout}
          label={e('username')}
          hasFeedback
          name='user'
        >
          <Input />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('password')}
          hasFeedback
          name='password'
        >
          <Input.Password />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('secure')}
          name='secure'
          valuePropName='secure'
        >
          <Switch />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('bookmarkCategory')}
          name='category'
        >
          <TreeSelect
            treeData={tree}
            treeDefaultExpandAll
            showSearch
          />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='type'
          name='type'
          className='hide'
        >
          <Input />
        </FormItem>
      </div>
    )
  }

  return (
    <Form
      form={form}
      onFinish={handleFinish}
      initialValues={initialValues}
      name='vnc-form'
    >
      {renderCommon()}
      {submitUi}
    </Form>
  )
}
