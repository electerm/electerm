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
import { tailFormItemLayout } from '../../common/form-layout'
import useFuncs from './use-form-funcs'

const FormItem = Form.Item
const e = window.translate

export default function useBookmarkSubmit (props) {
  const [
    form,
    save,
    saveAndCreateNew,
    connect,
    testConnection,
    handleFinish
  ] = useFuncs(props)
  const ui = (
    <FormItem {...tailFormItemLayout}>
      <p>
        <Button
          type='primary'
          htmlType='submit'
          className='mg1r mg1b'
        >{e('saveAndConnect')}
        </Button>
        <Button
          type='primary'
          className='mg1r mg1b'
          onClick={saveAndCreateNew}
        >{e('saveAndCreateNew')}
        </Button>
        <Button
          type='dashed'
          className='mg1r mg1b'
          onClick={save}
        >{e('save')}
        </Button>
      </p>
      <p>
        <Button
          type='dashed'
          onClick={connect}
          className='mg1r mg1b'
        >{e('connect')}
        </Button>
        <Button
          type='dashed'
          onClick={testConnection}
          className='mg1r mg1b'
        >{e('testConnection')}
        </Button>
      </p>
    </FormItem>
  )
  return [form, handleFinish, ui]
}
