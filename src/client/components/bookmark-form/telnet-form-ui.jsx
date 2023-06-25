/**
 * bookmark form
 */
import { useEffect } from 'react'
import {
  Input,
  Tabs,
  AutoComplete,
  Form
} from 'antd'
import {
  newBookmarkIdPrefix,
  terminalTelnetType
} from '../../common/constants'
import { formItemLayout } from '../../common/form-layout'
import findBookmarkGroupId from '../../common/find-bookmark-group-id'
import defaultSettings from '../../../app/common/default-setting'
import useSubmit from './use-submit'
import useUI from './use-ui'
import useQm from './use-quick-commands'
import renderCommon from './form-ssh-common'
import copy from 'json-deep-copy'
import _ from 'lodash'
import './bookmark-form.styl'

const { TabPane } = Tabs
const FormItem = Form.Item
const { prefix } = window
const e = prefix('form')
const s = prefix('setting')

export default function TelnetFormUI (props) {
  const [
    form,
    handleFinish,
    submitUi
  ] = useSubmit(props)
  useEffect(() => {
    if ((props.formData.id || '').startsWith(newBookmarkIdPrefix)) {
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
    port: 23,
    id: '',
    username: 'root',
    password: 'guest',
    term: defaultSettings.terminalType,
    type: terminalTelnetType,
    category: initBookmarkGroupId
  }
  initialValues = _.defaultsDeep(initialValues, defaultValues)
  function renderAuth () {
    const opts = {
      options: _.uniqBy(
        props.store.getBookmarks()
          .filter(d => d.password),
        (d) => d.password
      )
        .map(d => {
          return {
            label: `${d.title ? `(${d.title})` : ''}${d.username}:${d.host}-******`,
            value: d.password
          }
        }),
      placeholder: e('password'),
      allowClear: false
    }
    return (
      <FormItem
        {...formItemLayout}
        label={e('password')}
        name='password'
        hasFeedback
        rules={[{
          max: 1024, message: '1024 chars max'
        }]}
      >
        <AutoComplete
          {...opts}
        >
          <Input.Password />
        </AutoComplete>
      </FormItem>
    )
  }
  const tprops = {
    ...props,
    renderAuth,
    form
  }

  function renderTabs () {
    return (
      <Tabs>
        <TabPane tab={e('auth')} key='auth' forceRender>
          {renderCommon(tprops)}
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
      name='ssh-form'
      onFinish={handleFinish}
      initialValues={initialValues}
    >
      {renderTabs()}
      {submitUi}
    </Form>
  )
}
