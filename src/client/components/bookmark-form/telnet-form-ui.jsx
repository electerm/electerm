/**
 * bookmark form
 */

import {
  Input,
  Tabs,
  Form
} from 'antd'
import { useState, useEffect } from 'react'
import {
  newBookmarkIdPrefix,
  terminalTelnetType,
  authTypeMap
} from '../../common/constants'
import { formItemLayout } from '../../common/form-layout'
import findBookmarkGroupId from '../../common/find-bookmark-group-id'
import defaultSettings from '../../common/default-setting'
import useSubmit from './use-submit'
import useUI from './use-ui'
import useQm from './use-quick-commands'
import renderCommon from './form-ssh-common'
import { getRandomDefaultColor } from '../../common/rand-hex-color.js'
import copy from 'json-deep-copy'
import { defaultsDeep, isEmpty } from 'lodash-es'
import renderAuth from './render-auth-ssh'
import './bookmark-form.styl'

const FormItem = Form.Item
const e = window.translate

export default function TelnetFormUI (props) {
  const [
    form,
    handleFinish,
    submitUi
  ] = useSubmit(props)
  const [authType, setAuthType] = useState(props.formData.authType || authTypeMap.password)
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
  function onChangeAuthType (e) {
    setAuthType(e.target.value)
  }
  const defaultValues = {
    port: 23,
    id: '',
    username: 'root',
    password: 'guest',
    color: getRandomDefaultColor(),
    runScripts: [{}],
    term: defaultSettings.terminalType,
    displayRaw: false,
    type: terminalTelnetType,
    category: initBookmarkGroupId,
    authType: authTypeMap.password
  }
  initialValues = defaultsDeep(initialValues, defaultValues)

  const tprops = {
    ...props,
    renderAuth,
    authType,
    onChangeAuthType,
    form,
    bookmarkType: terminalTelnetType,
    filterAuthType: a => a !== 'privateKey',
    profileFilter: d => !isEmpty(d.telnet)
  }

  function renderTabs () {
    const items = [
      {
        key: 'auth',
        label: e('auth'),
        forceRender: true,
        children: (
          <div>
            {renderCommon(tprops)}
            <FormItem {...formItemLayout} label={e('type')} name='type' className='hide'>
              <Input />
            </FormItem>
          </div>
        )
      },
      {
        key: 'settings',
        label: e('settings'),
        forceRender: true,
        children: uis
      },
      {
        key: 'quickCommands',
        label: e('quickCommands'),
        forceRender: true,
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
      name='ssh-form'
      onFinish={handleFinish}
      initialValues={initialValues}
    >
      {renderTabs()}
      {submitUi}
    </Form>
  )
}
