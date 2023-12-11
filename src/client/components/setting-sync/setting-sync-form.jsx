/**
 * setting sync panel，
 */

/**
 * bookmark form
 */
import { useDelta, useConditionalEffect } from 'react-delta'
import { ArrowDownOutlined, ArrowUpOutlined, SaveOutlined, ClearOutlined } from '@ant-design/icons'
import { Button, Input, notification, Form } from 'antd'
import Link from '../common/external-link'
import dayjs from 'dayjs'
import eq from 'fast-deep-equal'
import { syncTokenCreateUrls, syncTypes } from '../../common/constants'
import './sync.styl'
import HelpIcon from '../common/help-icon'

const FormItem = Form.Item
const { prefix } = window
const e = prefix('form')
const ss = prefix('settingSync')
const s = prefix('setting')
const sh = prefix('ssh')

export default function SyncForm (props) {
  const [form] = Form.useForm()
  const delta = useDelta(props.formData)
  useConditionalEffect(() => {
    form.resetFields()
  }, delta && delta.prev && !eq(delta.prev, delta.curr))

  function disabled () {
    const {
      token,
      gistId
    } = props.formData
    return !token || !gistId
  }

  async function save (res) {
    const { syncType } = props
    const up = {
      [syncType + 'AccessToken']: res.token
    }
    if (res.gistId) {
      up[syncType + 'GistId'] = res.gistId
    }
    if (res.syncPassword) {
      up[syncType + 'SyncPassword'] = res.syncPassword
    }
    if (res.apiUrl) {
      up[syncType + 'ApiUrl'] = res.apiUrl
    }
    props.store.updateSyncSetting(up)
    const test = await props.store.testSyncToken(syncType, res.gistId)
    if (!test) {
      return notification.error({
        message: 'token invalid'
      })
    }
    if (!res.gistId) {
      props.store.createGist(syncType)
    }
  }

  function upload () {
    props
      .store
      .uploadSetting(props.syncType)
      .catch(props.store.onError)
  }

  function download () {
    props
      .store
      .downloadSetting(props.syncType)
      .catch(props.store.onError)
  }

  // onChangeAutoSync = checked => {
  //   this.props.store.updateSyncSetting({
  //     autoSync: checked
  //   })
  // }

  function getTokenCreateGuideUrl () {
    return syncTokenCreateUrls[props.syncType]
  }

  function renderGistUrl () {
    if (!props.formData.url) {
      return null
    }
    return (
      <Link to={props.formData.url}>Check gist</Link>
    )
  }

  const {
    lastSyncTime = ''
  } = props.formData
  const { syncType } = props
  const isCustom = syncType === syncTypes.custom
  const timeFormatted = lastSyncTime
    ? dayjs(lastSyncTime).format('YYYY-MM-DD HH:mm:ss')
    : '-'
  const customNameMapper = {
    token: 'JWT Secret',
    gist: 'User ID'
  }
  const otherNameMapper = {
    token: 'access token',
    gistId: 'gist id'
  }
  function createLabel (name, text) {
    return (
      <span>
        {isCustom ? (customNameMapper[name] || name) : name}
        <HelpIcon link={getTokenCreateGuideUrl()} />
      </span>
    )
  }
  function createPlaceHolder (name) {
    if (syncType === syncTypes.custom) {
      return customNameMapper[name]
    }
    return syncType + ' ' + otherNameMapper[name]
  }
  function createId (name) {
    return 'sync-input-' + name + '-' + syncType
  }
  function createUrlItem () {
    if (syncType !== syncTypes.custom) {
      return null
    }
    return (
      <FormItem
        label={createLabel('API Url')}
        name='apiUrl'
        rules={[{
          max: 200, message: '200 chars max'
        }]}
      >
        <Input
          placeholder='API Url'
          id='sync-input-url-custom'
        />
      </FormItem>
    )
  }
  const desc = syncType === syncTypes.custom
    ? 'jwt secret'
    : 'personal access token'
  const idDesc = syncType === syncTypes.custom
    ? 'user id'
    : 'gist ID'
  const tokenLabel = createLabel('token', desc)
  const gistLabel = createLabel('gist', idDesc)
  const syncPasswordName = s('encrypt') + ' ' + e('password')
  const syncPasswordLabel = createLabel(syncPasswordName, '')
  return (
    <Form
      onFinish={save}
      form={form}
      className='form-wrap pd1x'
      name={'setting-sync-form' + syncType}
      layout='vertical'
      initialValues={props.formData}
    >
      {createUrlItem()}
      <FormItem
        label={tokenLabel}
        hasFeedback
        name='token'
        rules={[{
          max: 100, message: '100 chars max'
        }, {
          required: true, message: createPlaceHolder('token') + ' required'
        }]}
      >
        <Input.Password
          placeholder={createPlaceHolder('token')}
          id={createId('token')}
        />
      </FormItem>
      <FormItem
        label={gistLabel}
        name='gistId'
        rules={[{
          max: 100, message: '100 chars max'
        }]}
      >
        <Input
          placeholder={createPlaceHolder('gistId')}
          id={createId('gistId')}
        />
      </FormItem>
      <FormItem
        label={syncPasswordLabel}
        hasFeedback
        name='syncPassword'
        rules={[{
          max: 100, message: '100 chars max'
        }]}
      >
        <Input.Password
          placeholder={syncType + ' ' + syncPasswordName}
        />
      </FormItem>
      {/* <FormItem
        {...formItemLayout}
        label={ss('autoSync')}
      >
        <Switch
          checked={autoSync}
          disabled={this.disabled()}
          onChange={this.onChangeAutoSync}
        />
      </FormItem> */}
      <FormItem>
        <p>
          <Button
            type='dashed'
            className='mg1r mg1b sync-btn-save'
            htmlType='submit'
            icon={<SaveOutlined />}
          >{e('save')}
          </Button>
          {/* <Button
            type='dashed'
            onClick={this.sync}
            disabled={this.disabled()}
            className='mg1r'
            loading={isSyncingSetting}
            icon='swap'
          >{ss('sync')}</Button> */}
          <Button
            type='dashed'
            onClick={upload}
            disabled={disabled()}
            className='mg1r mg1b'
            icon={<ArrowUpOutlined />}
          >{ss('uploadSettings')}
          </Button>
          <Button
            type='dashed'
            onClick={download}
            disabled={disabled()}
            className='mg1r mg1b sync-btn-down'
            icon={<ArrowDownOutlined />}
          >{ss('downloadSettings')}
          </Button>
          <Button
            type='dashed'
            onClick={props.store.handleClearSyncSetting}
            disabled={disabled()}
            className='mg1r mg1b sync-btn-clear'
            icon={<ClearOutlined />}
          >{sh('clear')}
          </Button>
        </p>
        <p>
          {ss('lastSyncTime')}: {timeFormatted}
        </p>
        <p>
          {renderGistUrl()}
        </p>
      </FormItem>
    </Form>
  )
}
