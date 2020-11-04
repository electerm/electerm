/**
 * bookmark form
 */
import { useRef } from 'react'
import {
  Form
} from 'antd'

export default function useFormFuncs (props) {
  const [form] = Form.useForm()
  const action = useRef('submit')
  function save () {
    action.current = 'save'
    form.submit()
  }
  function saveAndCreateNew () {
    action.current = 'saveAndCreateNew'
    form.submit()
  }
  function testConnection () {
    action.current = 'testConnection'
    form.submit()
  }
  function handleFinish (res) {
    if (action.current === 'save') {
      props.save(res)
    } else if (action.current === 'saveAndCreateNew') {
      props.saveAndCreateNew(res)
    } else if (action.current === 'testConnection') {
      props.testConnection(res)
    } else {
      props.handleFinish(res)
    }
    action.current = 'submit'
  }
  return [
    form,
    save,
    saveAndCreateNew,
    testConnection,
    handleFinish
  ]
}
