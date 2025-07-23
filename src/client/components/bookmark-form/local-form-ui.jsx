/**
 * bookmark form
 */

import { useEffect } from 'react'
import {
  Tabs,
  Input,
  Form
} from 'antd'
import { formItemLayout } from '../../common/form-layout'
import {
  newBookmarkIdPrefix,
  terminalLocalType
} from '../../common/constants'
import findBookmarkGroupId from '../../common/find-bookmark-group-id'
import useSubmit from './use-submit'
import useUI from './use-ui'
import useQm from './use-quick-commands'
import copy from 'json-deep-copy'
import renderTermBg from './render-bg'
import { defaults } from 'lodash-es'
import renderRunScripts from './render-delayed-scripts.jsx'
import { ColorPickerItem } from './color-picker-item.jsx'
import { getColorFromCategory } from '../../common/get-category-color.js'
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
  const qms = useQm(form, props.formData)
  const uis = useUI(props)
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
    category: initBookmarkGroupId,
    term: props.store.config.terminalType,
    displayRaw: false,
    type: terminalLocalType,
    color: getColorFromCategory(bookmarkGroups, currentBookmarkGroupId),
    runScripts: [{}],
    enableSsh: true
  }
  initialValues = defaults(initialValues, defaultValues)
  function renderCommon () {
    const {
      bookmarkGroups = []
    } = props
    return (
      <div className='pd1x'>
        {renderRunScripts()}
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
          label='type'
          name='type'
          className='hide'
        >
          <Input />
        </FormItem>
      </div>
    )
  }

  function renderTabs () {
    const items = [
      {
        key: 'auth',
        label: e('auth'),
        forceRender: true,
        children: renderCommon()
      },
      {
        key: 'settings',
        label: e('settings'),
        forceRender: true,
        children: (
          <>
            {uis}
            {renderTermBg(form)}
          </>
        )
      },
      {
        key: 'quickCommands',
        forceRender: true,
        label: e('quickCommands'),
        children: qms
      }
    ]
    return (
      <Tabs
        items={items}
      />
    )
  }

  return (
    <Form
      form={form}
      onFinish={handleFinish}
      initialValues={initialValues}
      name='local-form'
    >
      {renderTabs({ form })}
      {submitUi}
    </Form>
  )
}
