/**
 * bookmark form
 */
import { BookmarkForm } from './ssh-form'
import {
  Form, Button,
  Tabs, Spin, Icon, Input,
  Select, Switch, AutoComplete
} from 'antd'
import { validateFieldsAndScroll } from '../../common/dec-validate-and-scroll'
import { formItemLayout, tailFormItemLayout } from '../../common/form-layout'
import {
  commonBaudRates,
  commonDataBits,
  commonStopBits,
  commonParities,
  terminalSerialType
} from '../../common/constants'

const { TabPane } = Tabs
const FormItem = Form.Item
const { Option } = Select
const { prefix } = window
const e = prefix('form')
const c = prefix('common')
const s = prefix('setting')
const m = prefix('menu')

@Form.create()
@validateFieldsAndScroll
class SerialForm extends BookmarkForm {
  componentDidMount () {
    this.props.store.getSerials()
  }

  renderCommon () {
    const { getFieldDecorator } = this.props.form
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
    } = this.props.formData
    const {
      bookmarkGroups = [],
      serials = [],
      loaddingSerials,
      currentBookmarkGroupId
    } = this.props
    const initBookmarkGroupId = id
      ? this.findBookmarkGroupId(bookmarkGroups, id)
      : currentBookmarkGroupId

    return (
      <Form onSubmit={this.handleSubmit} className='pd1x'>
        <FormItem
          {...formItemLayout}
          label='path'
        >
          {getFieldDecorator('path', {
            rules: [{
              required: true, message: 'path required'
            }],
            normalize: this.trim,
            initialValue: path
          })(
            <AutoComplete
              dataSource={serials.map(d => d.path)}
            />
          )}
          <Spin spinning={loaddingSerials}>
            <span onClick={this.props.store.getSerials}>
              <Icon type='reload' /> {m('reload')} serials
            </span>
          </Spin>
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='baudRate'
          normalize={parseInt}
        >
          {getFieldDecorator('baudRate', {
            initialValue: baudRate
          })(
            <Select>
              {
                commonBaudRates.map(s => {
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
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='dataBits'
          normalize={parseInt}
        >
          {getFieldDecorator('dataBits', {
            initialValue: dataBits
          })(
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
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='stopBits'
          normalize={parseInt}
        >
          {getFieldDecorator('stopBits', {
            initialValue: stopBits
          })(
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
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='parity'
        >
          {getFieldDecorator('parity', {
            initialValue: parity
          })(
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
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='lock'
        >
          {getFieldDecorator('lock', {
            initialValue: lock,
            valuePropName: 'checked'
          })(
            <Switch />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='rtscts'
        >
          {getFieldDecorator('rtscts', {
            initialValue: rtscts,
            valuePropName: 'checked'
          })(
            <Switch />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='xon'
        >
          {getFieldDecorator('xon', {
            initialValue: xon,
            valuePropName: 'checked'
          })(
            <Switch />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='xoff'
        >
          {getFieldDecorator('xoff', {
            initialValue: xoff,
            valuePropName: 'checked'
          })(
            <Switch />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label='xany'
        >
          {getFieldDecorator('xany', {
            initialValue: xany,
            valuePropName: 'checked'
          })(
            <Switch />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('title')}
          hasFeedback
        >
          {getFieldDecorator('title', {
            initialValue: title
          })(
            <Input />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('type')}
          className='hide'
        >
          {getFieldDecorator('type', {
            initialValue: type
          })(
            <Input />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={c('bookmarkCategory')}
        >
          {getFieldDecorator('category', {
            initialValue: initBookmarkGroupId
          })(
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
          )}
        </FormItem>
      </Form>
    )
  }

  renderTabs () {
    return (
      <Tabs type='card'>
        <TabPane tab={e('auth')} key='auth' forceRender>
          {this.renderCommon()}
        </TabPane>
        <TabPane tab={s('settings')} key='settings' forceRender>
          {this.renderUI()}
        </TabPane>
        <TabPane tab={e('quickCommands')} key='quickCommands' forceRender>
          {this.renderQuickCommands()}
        </TabPane>
      </Tabs>
    )
  }

  render () {
    return (
      <Form onSubmit={this.handleSubmit}>
        {this.renderTabs()}
        <FormItem {...tailFormItemLayout}>
          <p>
            <Button
              type='primary'
              htmlType='submit'
              className='mg1r'
            >{e('saveAndConnect')}</Button>
            <Button
              type='ghost'
              className='mg1r'
              onClick={() => this.handleSubmit('save')}
            >{e('save')}</Button>
            <Button
              type='ghost'
              onClick={this.handleSubmit}
              className='mg2r'
            >{e('connect')}</Button>
          </p>
          <p>
            <Button
              type='ghost'
              loading={this.state.testing}
              onClick={e => this.handleSubmit(e, true)}
            >{e('testConnection')}</Button>
          </p>
        </FormItem>
      </Form>
    )
  }
}

export default SerialForm
