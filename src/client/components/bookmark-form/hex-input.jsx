import { Input } from 'antd'
import { useState } from 'react'
import {
  CheckOutlined
} from '@ant-design/icons'

export const HexInput = (props) => {
  const [v, setV] = useState(props.value.replace('#', ''))
  const handleChange = (event) => {
    const vv = event.target.value
    const hexRegex = /^[0-9a-fA-F]{0,6}$/
    if (hexRegex.test(vv)) {
      setV(vv)
    }
  }
  function submit () {
    props.onChange('#' + v)
  }
  function renderAfter () {
    if (!/^[0-9a-fA-F]{6}$/.test(v)) {
      return null
    }
    return (
      <CheckOutlined
        className='pointer'
        onClick={submit}
      />
    )
  }
  return (
    <Input
      addonBefore='#'
      {...props}
      value={v}
      onChange={handleChange}
      addonAfter={renderAfter()}
    />
  )
}
