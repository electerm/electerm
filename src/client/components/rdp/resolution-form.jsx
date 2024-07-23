import {
  Form,
  InputNumber,
  Space,
  Button,
  Table
} from 'antd'
import { MinusCircleFilled, CheckOutlined } from '@ant-design/icons'
import { formItemLayout, tailFormItemLayout } from '../../common/form-layout'

import resolutions from './resolutions'

const FormItem = Form.Item
const e = window.translate

export default function ResolutionForm (props) {
  const {
    list,
    initialValues
  } = props
  const [formChild] = Form.useForm()
  function handleFinish (data) {
    props.submit(data)
    formChild.resetFields()
  }

  function remove (id) {
    props.remove(id)
  }
  const cols = [
    {
      title: 'NO.',
      dataIndex: 'index',
      key: 'index',
      render: (k) => k
    }, {
      title: 'Resolutions',
      key: 'customResolutions',
      render: (k, item) => {
        return `${item.width}x${item.height}`
      }
    }, {
      title: e('del'),
      key: 'op',
      dataIndex: 'id',
      render: (id, item) => {
        if (item.readonly) {
          return '-'
        }
        return (
          <MinusCircleFilled
            className='pointer'
            onClick={() => remove(id)}
          />
        )
      }
    }
  ]

  function renderList () {
    const all = [
      ...list,
      ...resolutions
    ]
    return (
      <FormItem {...tailFormItemLayout}>
        <Table
          columns={cols}
          className='mg3b'
          pagination={false}
          size='small'
          dataSource={all.map((d, i) => {
            return {
              ...d,
              index: i + 1
            }
          })}
        />
      </FormItem>
    )
  }

  return (
    <div className='pd3t'>
      <Form
        form={formChild}
        onFinish={handleFinish}
        initialValues={initialValues}
      >
        <FormItem
          label={e('resolutions')}
          {...formItemLayout}
          required
          className='ssh-tunnels-host'
        >
          <Space.Compact>
            <FormItem
              name='width'
              label=''
              required
            >
              <InputNumber
                min={600}
                max={8192}
                placeholder={e('width')}
              />
            </FormItem>
            <span className='pd1x'>x</span>
            <FormItem
              label=''
              name='height'
              required
            >
              <InputNumber
                min={600}
                max={8192}
                placeholder={e('height')}
              />
            </FormItem>
            <Button
              htmlType='submit'
              icon={<CheckOutlined />}
            />
          </Space.Compact>
        </FormItem>
      </Form>

      {renderList()}
    </div>
  )
}
