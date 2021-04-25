/**
 * bookmark form
 */
import { useState, useEffect } from 'react'
import {
  Button,
  Input,
  InputNumber,
  Radio,
  Upload,
  Tabs,
  TreeSelect,
  Select,
  Switch,
  AutoComplete,
  Form
} from 'antd'
import {
  authTypeMap,
  defaultUserName,
  defaultLoginScriptDelay,
  newBookmarkIdPrefix,
  defaultEnvLang
} from '../../common/constants'
import { formItemLayout, tailFormItemLayout } from '../../common/form-layout'
import InputAutoFocus from '../common/input-auto-focus'
import encodes from './encodes'
import formatBookmarkGroups from './bookmark-group-tree-format'
import findBookmarkGroupId from '../../common/find-bookmark-group-id'
import useSubmit from './use-submit'
import useUI from './use-ui'
import useQm from './use-quick-commands'
import copy from 'json-deep-copy'
import _ from 'lodash'
import './bookmark-form.styl'

const { TabPane } = Tabs
const { TextArea } = Input
const authTypes = Object.keys(authTypeMap).map(k => {
  return k
})
const RadioButton = Radio.Button
const RadioGroup = Radio.Group
const FormItem = Form.Item
const { Option } = Select
const { prefix } = window
const e = prefix('form')
const c = prefix('common')
const s = prefix('setting')
const sf = prefix('sftp')

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
  const authTypeRenders = {}
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
    enableSftp: true,
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
  authTypeRenders.password = () => {
    const opts = {
      options: _.uniqBy(
        props.store
          .bookmarks
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
  authTypeRenders.privateKey = () => {
    return [
      <FormItem
        {...formItemLayout}
        label={e('privateKey')}
        hasFeedback
        key='privateKey'
        className='mg1b'
        rules={[{
          max: 13000, message: '13000 chars max'
        }]}
      >
        <FormItem noStyle name='privateKey'>
          <TextArea
            placeholder={e('privateKeyDesc')}
            rows={1}
          />
        </FormItem>
        <Upload
          beforeUpload={file => props.beforeUpload(file, form)}
          fileList={[]}
        >
          <Button
            type='ghost'
            className='mg2b mg1t'
          >
            {e('importFromFile')}
          </Button>
        </Upload>
      </FormItem>,
      <FormItem
        key='passphrase'
        {...formItemLayout}
        label={e('passphrase')}
        name='passphrase'
        hasFeedback
        rules={[{
          max: 128, message: '128 chars max'
        }]}
      >
        <Input.Password
          placeholder={e('passphraseDesc')}
        />
      </FormItem>
    ]
  }
  function renderAuth () {
    return authTypeRenders[authType]()
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
          }, {
            required: true, message: 'username required'
          }]}
          normalize={props.trim}
        >
          <Input placeholder={defaultUserName} />
        </FormItem>
        <FormItem
          {...tailFormItemLayout}
          className='mg1b'
          name='authType'
        >
          <RadioGroup
            size='small'
            onChange={onChangeAuthType}
            buttonStyle='solid'
          >
            {
              authTypes.map(t => {
                return (
                  <RadioButton value={t} key={t}>
                    {e(t)}
                  </RadioButton>
                )
              })
            }
          </RadioGroup>
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
        <FormItem
          {...formItemLayout}
          key='encode-select'
          label={e('encode')}
          name='encode'
        >
          <Select
            showSearch
          >
            {
              encodes.map(k => {
                return (
                  <Option
                    value={k}
                    key={k}
                  >
                    {k}
                  </Option>
                )
              })
            }
          </Select>
        </FormItem>
      </div>
    )
  }
  function renderEnableSftp () {
    return [
      <FormItem
        {...formItemLayout}
        label='SSH'
        name='enableSsh'
        key='ssh'
        valuePropName='checked'
      >
        <Switch />
      </FormItem>,
      <FormItem
        {...formItemLayout}
        label='Sftp'
        name='enableSftp'
        key='sftp'
        valuePropName='checked'
      >
        <Switch />
      </FormItem>,
      <FormItem
        {...formItemLayout}
        label={e('ignoreKeyboardInteractive')}
        name='ignoreKeyboardInteractive'
        key='ignoreKeyboardInteractive'
        valuePropName='checked'
      >
        <Switch />
      </FormItem>
    ]
  }

  function renderProxySelect () {
    const proxyList = props.bookmarks
      .reduce((prev, current) => {
        const { proxy } = current
        const {
          proxyIp,
          proxyPort,
          proxyType
        } = proxy || {}
        if (!proxy || !proxyIp || !proxyPort) {
          return prev
        }
        const id = proxyType === '0'
          ? `http://${proxyIp}:${proxyPort}`
          : `socks${proxyType}://${proxyIp}:${proxyPort}`
        return {
          ...prev,
          [id]: proxy
        }
      }, {})
    const keys = Object.keys(proxyList)
    if (!keys.length) {
      return null
    }
    return (
      <FormItem
        {...tailFormItemLayout}
        className='mg0'
        key='proxy-select'
      >
        <Select
          placeholder={e('selectProxy')}
          value={undefined}
          onSelect={
            v => props.onSelectProxy(proxyList[v], form)
          }
        >
          {
            keys.map(k => {
              return (
                <Option
                  value={k}
                  key={k}
                >
                  {k}
                </Option>
              )
            })
          }
        </Select>
      </FormItem>
    )
  }
  function renderProxy () {
    return [
      renderProxySelect(),
      <FormItem
        {...formItemLayout}
        label={e('proxyIp')}
        key='proxyIp'
        name={['proxy', 'proxyIp']}
        rules={[{
          max: 530, message: '530 chars max'
        }]}
      >
        <Input
          placeholder={e('proxyIpPlaceholder')}
        />
      </FormItem>,
      <FormItem
        {...formItemLayout}
        label={e('proxyPort')}
        key='proxyPort'
        name={['proxy', 'proxyPort']}
      >
        <InputNumber
          placeholder={e('proxyPort')}
          min={1}
          max={65535}
          step={1}
        />
      </FormItem>,
      <FormItem
        {...formItemLayout}
        label={e('proxyType')}
        key='proxyType'
        name={['proxy', 'proxyType']}
      >
        <Select>
          <Option value='5'>SOCKS5</Option>
          <Option value='4'>SOCKS4</Option>
          <Option value='0'>HTTP</Option>
        </Select>
      </FormItem>,
      <FormItem
        {...formItemLayout}
        label='Auth'
        key='proxyAuth'
      >
        <Input.Group compact>
          <FormItem
            noStyle
            name={['proxy', 'proxyUsername']}
            rules={[{
              max: 128, message: '128 chars max'
            }]}
          >
            <Input
              placeholder={e('username')}
            />
          </FormItem>
          <FormItem
            name={['proxy', 'proxyPassword']}
            rules={[{
              max: 128, message: '128 chars max'
            }]}
          >
            <Input
              placeholder={e('password')}
            />
          </FormItem>
        </Input.Group>
      </FormItem>
    ]
  }
  function renderX11 () {
    return (
      <FormItem
        {...formItemLayout}
        label='x11'
        name='x11'
        valuePropName='checked'
      >
        <Switch />
      </FormItem>
    )
  }

  function renderTabs () {
    return (
      <Tabs>
        <TabPane tab={e('auth')} key='auth' forceRender>
          {renderCommon()}
        </TabPane>
        <TabPane tab={s('settings')} key='settings' forceRender>
          {renderEnableSftp()}
          {uis}
          {renderProxy()}
          {renderX11()}
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
