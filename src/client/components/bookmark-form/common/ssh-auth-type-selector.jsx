import { Radio, Form } from 'antd'
import { authTypeMap } from '../../../common/constants'
import { tailFormItemLayout } from '../../../common/form-layout'

const authTypes = Object.keys(authTypeMap).map(k => {
  return k
})
const RadioButton = Radio.Button
const RadioGroup = Radio.Group
const e = window.translate
const FormItem = Form.Item

export default function SshAuthTypeSelector ({ onChangeAuthType, filterAuthType = a => a, value, ...props }) {
  const authTypesFiltered = authTypes.filter(filterAuthType)

  return (
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
          authTypesFiltered.map(t => {
            return (
              <RadioButton value={t} key={t}>
                {e(t)}
              </RadioButton>
            )
          })
        }
      </RadioGroup>
    </FormItem>
  )
}
