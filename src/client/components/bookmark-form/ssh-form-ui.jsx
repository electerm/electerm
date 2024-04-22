/**
 * bookmark form
 */
import { useState, useEffect } from 'react'
import {
  Form
} from 'antd'
import {
  authTypeMap,
  newBookmarkIdPrefix,
  defaultEnvLang
} from '../../common/constants'
import encodes from './encodes'
import findBookmarkGroupId from '../../common/find-bookmark-group-id'
import useSubmit from './use-submit'
import useUI from './use-ui'
import useQm from './use-quick-commands'
import copy from 'json-deep-copy'
import { defaultsDeep } from 'lodash-es'
import renderTabs from './form-tabs'
import renderCommon from './form-ssh-common'
import renderEnableSftp from './sftp-enable'
import renderProxy from './proxy'
import renderX11 from './x11'
import renderAuth from './render-auth-ssh'
import renderSshTunnel from './render-ssh-tunnel'
import renderConnectionHopping from './render-connection-hopping'
import { getRandomDefaultColor } from '../../common/rand-hex-color.js'
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
    authType: authTypeMap.password,
    id: '',
    color: getRandomDefaultColor(),
    term: props.store.config.terminalType,
    displayRaw: false,
    encode: encodes[0],
    envLang: defaultEnvLang,
    enableSsh: true,
    sshTunnels: [],
    runScripts: [{}],
    category: initBookmarkGroupId,
    connectionHoppings: []
  }
  initialValues = defaultsDeep(initialValues, defaultValues)
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
    renderSshTunnel,
    renderConnectionHopping
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
