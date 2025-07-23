/**
 * web form
 */

import { useEffect } from 'react'
import {
  Input,
  Form,
  Switch
} from 'antd'
import { formItemLayout } from '../../common/form-layout'
import {
  newBookmarkIdPrefix,
  terminalWebType
} from '../../common/constants'
import useSubmit from './use-submit'
import copy from 'json-deep-copy'
import { defaults } from 'lodash-es'
import { ColorPickerItem } from './color-picker-item.jsx'
import { getColorFromCategory } from '../../common/get-category-color.js'
import findBookmarkGroupId from '../../common/find-bookmark-group-id'
import BookmarkCategorySelect from './bookmark-category-select.jsx'

const FormItem = Form.Item
const e = window.translate

export default function LocalFormUi (props) {
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
  const initBookmarkGroupId = !id.startsWith(newBookmarkIdPrefix)
    ? findBookmarkGroupId(bookmarkGroups, id)
    : currentBookmarkGroupId
  let initialValues = copy(props.formData)
  const defaultValues = {
    type: terminalWebType,
    category: initBookmarkGroupId,
    color: getColorFromCategory(bookmarkGroups, currentBookmarkGroupId)
  }
  initialValues = defaults(initialValues, defaultValues)
  function renderCommon () {
    const {
      bookmarkGroups = []
    } = props
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
          label={e('URL')}
          hasFeedback
          name='url'
          required
          rules={[
            {
              required: true,
              message: e('Please input URL')
            },
            {
              validator: (_, value) =>
                /^[a-z\d.+-]+:\/\/[^\s/$.?#].[^\s]*$/i.test(value)
                  ? Promise.resolve()
                  : Promise.reject(new Error(e('URL must start with http:// or https://')))
            }
          ]}
        >
          <Input />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('description')}
          name='description'
          hasFeedback
        >
          <Input.TextArea autoSize={{ minRows: 1 }} />
        </FormItem>
        <BookmarkCategorySelect
          bookmarkGroups={bookmarkGroups}
          form={form}
        />
        <FormItem
          {...formItemLayout}
          label={e('useragent')}
          name='useragent'
        >
          <Input />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='hideAddressBar'
          name='hideAddressBar'
          valuePropName='checked'
        >
          <Switch />
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
      name='web-form'
    >
      {renderCommon()}
      {submitUi}
    </Form>
  )
}
