/**
 * web form
 */

import { useEffect } from 'react'
import {
  Input,
  Form,
  InputNumber,
  Alert
} from 'antd'
import { formItemLayout } from '../../common/form-layout'
import {
  newBookmarkIdPrefix,
  terminalRdpType,
  rdpWikiLink
} from '../../common/constants'
import useSubmit from './use-submit'
import copy from 'json-deep-copy'
import { defaults, isEmpty } from 'lodash-es'
import Password from '../common/password'
import { ColorPickerItem } from './color-picker-item.jsx'
import { getColorFromCategory } from '../../common/get-category-color.js'
import findBookmarkGroupId from '../../common/find-bookmark-group-id'
import ProfileItem from './profile-form-item'
import Link from '../common/external-link'
import BookmarkCategorySelect from './bookmark-category-select.jsx'

const FormItem = Form.Item
const e = window.translate

export default function RdpFormUi (props) {
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
    type: terminalRdpType,
    port: 3389,
    category: initBookmarkGroupId,
    color: getColorFromCategory(bookmarkGroups, currentBookmarkGroupId)

  }
  initialValues = defaults(initialValues, defaultValues)
  function renderCommon () {
    const {
      bookmarkGroups = []
    } = props
    const alertProps = {
      message: (
        <Link to={rdpWikiLink}>WIKI: {rdpWikiLink}</Link>
      ),
      type: 'warning',
      className: 'mg2y'
    }
    return (
      <div className='pd1x'>
        <Alert
          {...alertProps}
        />
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
          profileFilter={d => !isEmpty(d.rdp)}
        />
        <FormItem
          {...formItemLayout}
          label={e('username')}
          hasFeedback
          name='userName'
          required
        >
          <Input />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('password')}
          hasFeedback
          name='password'
          required
        >
          <Password />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('description')}
          name='description'
          hasFeedback
        >
          <Input.TextArea autoSize={{ minRows: 1 }} />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('domain')}
          hasFeedback
          name='domain'
        >
          <Input />
        </FormItem>
        <BookmarkCategorySelect
          bookmarkGroups={bookmarkGroups}
          form={form}
        />
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
      name='rdp-form'
    >
      {renderCommon()}
      {submitUi}
    </Form>
  )
}
