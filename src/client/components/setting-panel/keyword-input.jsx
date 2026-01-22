import { Input } from 'antd'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { useState, useEffect } from 'react'

export default function KeywordInput (props) {
  const { value, onChange, addonBefore, ...rest } = props
  const [localValue, setLocalValue] = useState(value || '')
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    setLocalValue(value || '')
  }, [value])

  function handleChange (e) {
    const newValue = e.target.value
    setLocalValue(newValue)
    setIsEditing(true)
  }

  function handleConfirm () {
    onChange(localValue)
    setIsEditing(false)
  }

  function handleCancel () {
    setLocalValue(value || '')
    setIsEditing(false)
  }

  function handleBlur () {
    // Optionally hide icons on blur, but since user might click icons, maybe not
    // setIsEditing(false)
  }

  const addonAfter = isEditing
    ? (
      <div>
        <CheckOutlined
          onClick={handleConfirm}
          className='mg1r pointer'
        />
        <CloseOutlined
          onClick={handleCancel}
          className='pointer'
        />
      </div>
      )
    : null

  return (
    <Input
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      addonBefore={addonBefore}
      addonAfter={addonAfter}
      {...rest}
    />
  )
}
