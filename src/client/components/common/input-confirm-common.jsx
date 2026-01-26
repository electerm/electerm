import React, { useState, useEffect } from 'react'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { Space } from 'antd'
import './input-confirm-common.styl'

export default function InputConfirmCommon ({
  value,
  onChange,
  inputComponent: InputComponent,
  iconPlacement = 'addonAfter', // 'addonAfter', 'suffix', or 'below'
  extraAddonAfter,
  ...rest
}) {
  const [localValue, setLocalValue] = useState(value)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  function handleChange (e) {
    const newValue = e && e.target ? e.target.value : e
    setLocalValue(newValue)
    setIsEditing(true)
  }

  function handleConfirm () {
    onChange(localValue)
    setIsEditing(false)
  }

  function handleCancel () {
    setLocalValue(value)
    setIsEditing(false)
  }

  const icons = isEditing
    ? (
      <>
        <CheckOutlined
          onClick={handleConfirm}
          className='mg1x pointer'
        />
        <CloseOutlined
          onClick={handleCancel}
          className='pointer'
        />
      </>
      )
    : null
  const { className, ...restProps } = rest
  const cls = className ? `${className} input-confirm` : 'input-confirm'
  const finalAddon = extraAddonAfter || icons
    ? (
      <Space.Addon>
        {extraAddonAfter}
        {icons}
      </Space.Addon>
      )
    : null

  const childProps = {
    ...restProps,
    value: localValue,
    onChange: handleChange
  }

  const inputElement = <InputComponent {...childProps} />

  return (
    <div>
      <Space.Compact className={cls}>
        {inputElement}
        {finalAddon}
      </Space.Compact>
    </div>
  )
}
