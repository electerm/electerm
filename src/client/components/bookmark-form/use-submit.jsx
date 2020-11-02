/**
 * submit buttons
 */

/**
 * bookmark form
 */

import {
  Button,
  Form
} from 'antd'
import {
  settingMap
} from '../../common/constants'
import { tailFormItemLayout } from '../../common/form-layout'
import useFuncs from './use-form-funcs'

const FormItem = Form.Item
const { prefix } = window
const e = prefix('form')

export function useBookmarkSubmit (props) {
  const [
    form,
    save,
    saveAndCreateNew,
    testConnection,
    handleFinish
  ] = useFuncs(props)
  const ui = (
    <FormItem {...tailFormItemLayout}>
      <p>
        <Button
          type='primary'
          htmlType='submit'
          className='mg1r'
        >{e('saveAndConnect')}</Button>
        {
          settingMap.history === props.type
            ? null
            : (
              <Button
                type='primary'
                className='mg1r'
                onClick={saveAndCreateNew}
              >{e('saveAndCreateNew')}</Button>
            )
        }
        <Button
          type='ghost'
          className='mg1r'
          onClick={save}
        >{e('save')}</Button>
      </p>
      <p>
        <Button
          type='ghost'
          onClick={testConnection}
        >{e('testConnection')}</Button>
      </p>
    </FormItem>
  )
  return [form, handleFinish, ui]
}
