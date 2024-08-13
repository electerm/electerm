/**
 * bookmark form
 */

import { useEffect } from 'react'
import { ReloadOutlined } from '@ant-design/icons'
import {
  Tabs,
  Spin,
  Input,
  Select,
  Switch,
  AutoComplete,
  Form,
  TreeSelect
} from 'antd'
import { formItemLayout } from '../../common/form-layout'
import parseInt10 from '../../common/parse-int10'
import {
  commonBaudRates,
  commonDataBits,
  commonStopBits,
  commonParities,
  terminalSerialType,
  newBookmarkIdPrefix
} from '../../common/constants'
import formatBookmarkGroups from './bookmark-group-tree-format'
import defaultSettings from '../../common/default-setting'
import findBookmarkGroupId from '../../common/find-bookmark-group-id'
import useSubmit from './use-submit'
import useUI from './use-ui'
import useQm from './use-quick-commands'
import copy from 'json-deep-copy'
import { defaults } from 'lodash-es'
import { getRandomDefaultColor } from '../../common/rand-hex-color.js'
import { ColorPickerItem } from './color-picker-item.jsx'

const FormItem = Form.Item
const { Option } = Select
const e = window.translate

export default function SerialFormUi (props) {
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
    color: getRandomDefaultColor(),
    baudRate: 9600,
    dataBits: 8,
    lock: true,
    stopBits: 1,
    parity: 'none',
    rtscts: false,
    xon: false,
    xoff: false,
    xany: false,
    type: terminalSerialType,
    term: defaultSettings.terminalType,
    displayRaw: false,
    category: initBookmarkGroupId,
    runScripts: [{}],
    ignoreKeyboardInteractive: false
  }
  initialValues = defaults(initialValues, defaultValues)
  function renderCommon () {
    const {
      bookmarkGroups = [],
      serials = [],
      loaddingSerials
    } = props
    const tree = formatBookmarkGroups(bookmarkGroups)
    return (
      <div className='pd1x'>
        <FormItem
          {...formItemLayout}
          label={e('title')}
          name='title'
          hasFeedback
        >
          <Input addonBefore={<ColorPickerItem />} />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='path'
          rules={[{
            required: true, message: 'path required'
          }]}
          normalize={props.trim}
        >
          <FormItem noStyle name='path'>
            <AutoComplete
              options={serials.map(d => {
                return {
                  value: d.path
                }
              })}
            />
          </FormItem>
          <Spin spinning={loaddingSerials}>
            <span onClick={props.store.handleGetSerials}>
              <ReloadOutlined /> {e('reload')} serials
            </span>
          </Spin>
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='baudRate'
          name='baudRate'
          normalize={parseInt10}
        >
          <AutoComplete
            options={commonBaudRates.map(d => {
              return {
                value: d + ''
              }
            })}
          />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='dataBits'
          name='dataBits'
          normalize={parseInt10}
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
          valuePropName='checked'
        >
          <Switch />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='rtscts'
          name='rtscts'
          valuePropName='checked'
        >
          <Switch />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='xon'
          name='xon'
          valuePropName='checked'
        >
          <Switch />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='xoff'
          name='xoff'
          valuePropName='checked'
        >
          <Switch />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='xany'
          name='xany'
          valuePropName='checked'
        >
          <Switch />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('description')}
          name='description'
          hasFeedback
        >
          <Input.TextArea autoSize={{ minRows: 1 }} />
        </FormItem>
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
          label={e('bookmarkCategory')}
          name='category'
        >
          <TreeSelect
            treeData={tree}
            treeDefaultExpandAll
            showSearch
          />
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
      <Tabs items={items} />
    )
  }

  return (
    <Form
      form={form}
      onFinish={handleFinish}
      initialValues={initialValues}
      name='serial-form'
    >
      {renderTabs()}
      {submitUi}
    </Form>
  )
}
