/**
 * bookmark form
 */
import {
  Input,
  InputNumber,
  Radio,
  TreeSelect,
  Select,
  Form
} from 'antd'
import {
  authTypeMap
} from '../../common/constants'
import { formItemLayout, tailFormItemLayout } from '../../common/form-layout'
import InputAutoFocus from '../common/input-auto-focus'
import encodes from './encodes'
import formatBookmarkGroups from './bookmark-group-tree-format'
import renderRunScripts from './render-delayed-scripts.jsx'
import { ColorPickerItem } from './color-picker-item.jsx'

import './bookmark-form.styl'

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
const sf = prefix('sftp')

export default function renderCommon (props) {
  const {
    autofocustrigger,
    bookmarkGroups = [],
    dns,
    form,
    onChangeAuthType
  } = props
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
            name='host'
            onBlur={props.onBlur}
            onPaste={e => props.onPaste(e, form)}
            addonBefore={<ColorPickerItem />}
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
        <Input />
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
      {props.renderAuth(props)}
      <FormItem
        {...formItemLayout}
        label={e('port')}
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
        name='setEnv'
        label='SetEnv'
      >
        <Input placeholder='SEC=xxx BEC=xxxx' />
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
      {renderRunScripts()}
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
