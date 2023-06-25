/**
 * bookmark form
 */
import { useState, useEffect } from 'react'
import {
  Form
} from 'antd'
import {
  authTypeMap,
  defaultLoginScriptDelay,
  newBookmarkIdPrefix,
  defaultEnvLang
} from '../../common/constants'
import encodes from './encodes'
import findBookmarkGroupId from '../../common/find-bookmark-group-id'
import useSubmit from './use-submit'
import useUI from './use-ui'
import useQm from './use-quick-commands'
import copy from 'json-deep-copy'
import _ from 'lodash'
import renderTabs from './form-tabs'
import renderCommon from './form-ssh-common'
import renderEnableSftp from './sftp-enable'
import renderProxy from './proxy'
import renderX11 from './x11'
import renderAuth from './render-auth-ssh'
import renderSshTunnel from './render-ssh-tunnel'
import './bookmark-form.styl'

export default function BookmarkFormUI (props) {
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
  const [authType, setAuthType] = useState(props.formData.authType || authTypeMap.password)
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
    port: 22,
    loginScriptDelay: defaultLoginScriptDelay,
    authType: authTypeMap.password,
    id: '',
    term: props.store.config.terminalType,
    encode: encodes[0],
    envLang: defaultEnvLang,
    enableSsh: true,
    category: initBookmarkGroupId,
    proxy: {
      proxyType: '5'
    }
  }
  initialValues = _.defaultsDeep(initialValues, defaultValues)
  function onChangeAuthType (e) {
    setAuthType(e.target.value)
  }
  const tprops = {
    ...props,
    uis,
    qms,
    onChangeAuthType,
    form,
    authType,
    renderCommon,
    renderEnableSftp,
    renderProxy,
    renderX11,
    renderAuth,
    renderSshTunnel
  }
  return (
    <Form
      form={form}
      name='ssh-form'
      onFinish={handleFinish}
      initialValues={initialValues}
    >
      {renderTabs(tprops)}
      {submitUi}
    </Form>
  )
}
