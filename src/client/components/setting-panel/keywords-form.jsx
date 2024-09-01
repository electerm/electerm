import {
  Form,
  Input,
  Select,
  Space,
  Button
} from 'antd'
import { formItemLayout } from '../../common/form-layout'
import {
  MinusCircleOutlined,
  PlusOutlined
} from '@ant-design/icons'
import { useEffect } from 'react'

const FormItem = Form.Item
const FormList = Form.List
const OptionSel = Select.Option
const e = window.translate

export default function KeywordForm (props) {
  const {
    formData
  } = props
  const [formChild] = Form.useForm()
  function handleTrigger () {
    formChild.submit()
  }

  function handleChange (e) {
    formChild.submit()
  }

  function handleFinish (data) {
    props.submit(data)
  }

  function checker (_, value) {
    try {
      return Promise.resolve(!!new RegExp(`(${value})`, 'gi'))
    } catch (e) {
      console.log(e, 'check keyword error')
      return Promise.reject(e)
    }
  }

  function renderItem (field, i, add, remove) {
    return (
      <Space
        align='center'
        key={field.key}
        className='mg3r'
      >
        <FormItem
          hasFeedback
        >
          <FormItem
            noStyle
            required
            name={[field.name, 'keyword']}
            rules={[{ validator: checker }]}
          >
            <Input
              addonBefore={renderBefore(field.name)}
              onChange={handleChange}
            />
          </FormItem>
        </FormItem>
        <Button
          icon={<MinusCircleOutlined />}
          onClick={() => remove(field.name)}
          className='mg24b'
        />
      </Space>
    )
  }

  function renderBefore (name) {
    const colors = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']
    const { themeConfig } = props
    return (
      <FormItem name={[name, 'color']} noStyle>
        <Select>
          {
            colors.map(color => {
              const ps = {
                className: 'color-picker-choose iblock',
                style: {
                  backgroundColor: themeConfig[color]
                }
              }
              return (
                <OptionSel key={color} value={color}>
                  <span
                    {...ps}
                  />
                </OptionSel>
              )
            })
          }
        </Select>
      </FormItem>
    )
  }

  useEffect(() => {
    formChild.resetFields()
  }, [props.keywordFormReset])

  return (
    <div>
      <Form
        form={formChild}
        onValuesChange={handleTrigger}
        initialValues={formData}
        onFinish={handleFinish}
      >
        <FormItem {...formItemLayout}>
          <FormList
            name='keywords'
          >
            {
              (fields, { add, remove }, { errors }) => {
                return (
                  <div>
                    {
                      fields.map((field, i) => {
                        return renderItem(field, i, add, remove)
                      })
                    }
                    <FormItem>
                      <Button
                        type='dashed'
                        onClick={() => add({
                          color: 'red'
                        })}
                        icon={<PlusOutlined />}
                      >
                        {e('keyword')}
                      </Button>
                    </FormItem>
                  </div>
                )
              }
            }
          </FormList>
        </FormItem>
      </Form>
    </div>
  )
}
