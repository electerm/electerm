/**
 * bookmark form
 */
import { ReloadOutlined } from '@ant-design/icons'
import { Tabs, Spin, Input, Select, Switch, AutoComplete, Form } from 'antd'
import { formItemLayout } from '../../common/form-layout'
import {
  commonBaudRates,
  commonDataBits,
  commonStopBits,
  commonParities,
  terminalSerialType
} from '../../common/constants'
import findBookmarkGroupId from '../../common/find-bookmark-group-id'
import useSubmit from './use-submit'
import useUI from './use-ui'
import useQm from './use-quick-commands'

const { TabPane } = Tabs
const FormItem = Form.Item
const { Option } = Select
const { prefix } = window
const e = prefix('form')
const c = prefix('common')
const s = prefix('setting')
const m = prefix('menu')

export default function SerialFormUi (props) {
  const [
    form,
    handleFinish,
    submitUi
  ] = useSubmit(props)
  const qms = useQm(form, props.formData)
  const uis = useUI(props)
  function renderCommon () {
    const {
      // autoOpen = true,
      baudRate = 9600,
      dataBits = 8,
      lock = true,
      stopBits = 1,
      parity = 'none',
      rtscts = false,
      xon = false,
      xoff = false,
      xany = false,
      path,
      title,
      id,
      type = terminalSerialType
    } = props.formData
    const {
      bookmarkGroups = [],
      serials = [],
      loaddingSerials,
      currentBookmarkGroupId
    } = props
    const initBookmarkGroupId = id
      ? findBookmarkGroupId(bookmarkGroups, id)
      : currentBookmarkGroupId

    return (
      <div className='pd1x'>
        <FormItem
          {...formItemLayout}
          label='path'
          rules={[{
            required: true, message: 'path required'
          }]}
          normalize={props.trim}
          initialValue={path}
          name='path'
        >
          <AutoComplete
            dataSource={serials.map(d => d.path)}
          />
          <Spin spinning={loaddingSerials}>
            <span onClick={props.store.getSerials}>
              <ReloadOutlined /> {m('reload')} serials
            </span>
          </Spin>
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='baudRate'
          name='baudRate'
          normalize={parseInt}
          initialValue={baudRate.toString()}
        >
          <AutoComplete
            dataSource={commonBaudRates.map(d => d + '')}
          />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='dataBits'
          name='dataBits'
          normalize={parseInt}
          initialValue={dataBits}
        >
          <Select>
            {
              commonDataBits.map(s => {
                return (
                  <Option
                    value={s}
                    key={s}
                  >
                    {s}
                  </Option>
                )
              })
            }
          </Select>
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='stopBits'
          name='stopBits'
          normalize={parseInt}
          initialValue={stopBits}
        >
          <Select>
            {
              commonStopBits.map(s => {
                return (
                  <Option
                    value={s}
                    key={s}
                  >
                    {s}
                  </Option>
                )
              })
            }
          </Select>
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='parity'
          name='parity'
          initialValue={parity}
        >
          <Select>
            {
              commonParities.map(s => {
                return (
                  <Option
                    value={s}
                    key={s}
                  >
                    {s}
                  </Option>
                )
              })
            }
          </Select>
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='lock'
          name='lock'
          initialValue={lock}
          valuePropName='checked'
        >
          <Switch />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='rtscts'
          name='rtscts'
          initialValue={rtscts}
          valuePropName='checked'
        >
          <Switch />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='xon'
          name='xon'
          initialValue={xon}
          valuePropName='checked'
        >
          <Switch />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='xoff'
          name='xoff'
          initialValue={xoff}
          valuePropName='checked'
        >
          <Switch />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='xany'
          name='xany'
          initialValue={xany}
          valuePropName='checked'
        >
          <Switch />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('title')}
          name='title'
          initialValue={title}
          hasFeedback
        >
          <Input />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('type')}
          name='type'
          className='hide'
          initialValue={type}
        >
          <Input />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={c('bookmarkCategory')}
          name='category'
          initialValue={initBookmarkGroupId}
        >
          <Select showSearch>
            {
              bookmarkGroups.map(bg => {
                return (
                  <Option
                    value={bg.id}
                    key={bg.id}
                  >
                    {bg.title}
                  </Option>
                )
              })
            }
          </Select>
        </FormItem>
      </div>
    )
  }

  function renderTabs () {
    return (
      <Tabs type='card'>
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
      initialValues={props.formData}
      name='serial-form'
    >
      {renderTabs()}
      {submitUi}
    </Form>
  )
}
