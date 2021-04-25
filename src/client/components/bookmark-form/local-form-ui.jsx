/**
 * bookmark form
 */

import { useEffect } from 'react'
import {
  Tabs,
  InputNumber,
  Input,
  TreeSelect,
  Form,
  Switch
} from 'antd'
import { formItemLayout } from '../../common/form-layout'
import {
  newBookmarkIdPrefix,
  terminalLocalType
} from '../../common/constants'
import formatBookmarkGroups from './bookmark-group-tree-format'
import findBookmarkGroupId from '../../common/find-bookmark-group-id'
import useSubmit from './use-submit'
import useUI from './use-ui'
import useQm from './use-quick-commands'
import copy from 'json-deep-copy'
import _ from 'lodash'

const { TabPane } = Tabs
const FormItem = Form.Item
const { prefix } = window
const e = prefix('form')
const c = prefix('common')
const s = prefix('setting')

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
    loginScriptDelay: 500,
    enableSftp: true,
    category: initBookmarkGroupId,
    term: props.store.config.terminalType,
    type: terminalLocalType,
    enableSsh: true
  }
  initialValues = _.defaults(initialValues, defaultValues)
  function renderCommon () {
    const {
      bookmarkGroups = []
    } = props
    const tree = formatBookmarkGroups(bookmarkGroups)
    return (
      <div className='pd1x'>
        <FormItem
          {...formItemLayout}
          label={e('loginScript')}
          name='loginScript'
          help={`* ${e('loginScriptTip')}`}
        >
          <Input.TextArea row={1} />
        </FormItem>
        <FormItem
          {...formItemLayout}
          name='loginScriptDelay'
          label={e('loginScriptDelay')}
        >
          <InputNumber
            placeholder='loginScriptDelay'
            min={1}
            max={65535}
            step={1}
            formatter={value => `${value} ms`}
          />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('title')}
          name='title'
          hasFeedback
        >
          <Input />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={c('bookmarkCategory')}
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
          label='Sftp'
          name='enableSftp'
          valuePropName='checked'
          className='hide'
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

  function renderTabs () {
    return (
      <Tabs>
        <TabPane tab={e('auth')} key='auth' forceRender>
          {renderCommon()}
        </TabPane>
        <TabPane tab={s('settings')} key='settings' forceRender>
          {uis}
        </TabPane>
        <TabPane tab={e('quickCommands')} key='quickCommands' forceRender>
          {qms}
        </TabPane>
      </Tabs>
    )
  }

  return (
    <Form
      form={form}
      onFinish={handleFinish}
      initialValues={initialValues}
      name='local-form'
    >
      {renderTabs()}
      {submitUi}
    </Form>
  )
}
