/**
 * bookmark form
 */
import { useEffect } from 'react'
import {
  Input,
  InputNumber,
  Tabs,
  TreeSelect,
  AutoComplete,
  Form
} from 'antd'
import {
  defaultUserName,
  newBookmarkIdPrefix,
  terminalTelnetType
} from '../../common/constants'
import { formItemLayout } from '../../common/form-layout'
import InputAutoFocus from '../common/input-auto-focus'
import formatBookmarkGroups from './bookmark-group-tree-format'
import findBookmarkGroupId from '../../common/find-bookmark-group-id'
import defaultSettings from '../../../app/common/default-setting'
import useSubmit from './use-submit'
import useUI from './use-ui'
import useQm from './use-quick-commands'
import copy from 'json-deep-copy'
import _ from 'lodash'
import './bookmark-form.styl'

const { TabPane } = Tabs
const FormItem = Form.Item
const { prefix } = window
const e = prefix('form')
const c = prefix('common')
const s = prefix('setting')
const sf = prefix('sftp')

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
          max: 128, message: '128 chars max'
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
  function renderCommon () {
    const {
      autofocustrigger,
      bookmarkGroups = []
    } = props
    const { dns } = props
    const tree = formatBookmarkGroups(bookmarkGroups)
    return (
      <div>
        <FormItem
          {...formItemLayout}
          label={e('type')}
          name='type'
          className='hide'
        >
          <Input />
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
        >
          {
            dns
              ? (
                <div className='dns-section'>
                  ip: {dns}
                  <span
                    className='color-blue pointer mg1l'
                    onClick={() => props.useIp(form)}
                  >
                    {e('use')}
                  </span>
                </div>
              )
              : (
                <div className='dns-section'>
                  hostname or ip
                </div>
              )
          }
          <FormItem noStyle name='host'>
            <InputAutoFocus
              autofocustrigger={autofocustrigger}
              selectall='yes'
              onBlur={props.onBlur}
              onPaste={e => props.onPaste(e, form)}
            />
          </FormItem>
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
          <Input placeholder={defaultUserName} />
        </FormItem>
        {renderAuth()}
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
          label={e('title')}
          hasFeedback
          name='title'
        >
          <Input />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('description')}
          name='description'
          hasFeedback
        >
          <Input.TextArea rows={1} />
        </FormItem>
        <FormItem
          {...formItemLayout}
          name='startDirectoryLocal'
          label={`${e('startDirectory')}:${sf('local')}`}
        >
          <Input />
        </FormItem>
        <FormItem
          {...formItemLayout}
          name='startDirectory'
          label={`${e('startDirectory')}:${sf('remote')}`}
        >
          <Input />
        </FormItem>
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
      name='ssh-form'
      onFinish={handleFinish}
      initialValues={initialValues}
    >
      {renderTabs()}
      {submitUi}
    </Form>
  )
}
