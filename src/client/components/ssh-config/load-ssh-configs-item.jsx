import { useState } from 'react'
import {
  Input
} from 'antd'
import {
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons'

const { TextArea } = Input

export default function LoadSshConfigsItem (props) {
  const { item, index, onDelete, onUpdate } = props
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(JSON.stringify(item, null, 2))

  const handleToggleEdit = function () {
    if (isEditing) {
      try {
        const parsed = JSON.parse(editValue)
        onUpdate(index, parsed)
      } catch (err) {
        console.error('Invalid JSON:', err)
        setEditValue(JSON.stringify(item, null, 2))
      }
    } else {
      setEditValue(JSON.stringify(item, null, 2))
    }
    setIsEditing(!isEditing)
  }

  const handleDelete = function () {
    onDelete(index)
  }

  const handleCancelEdit = function () {
    setEditValue(JSON.stringify(item, null, 2))
    setIsEditing(false)
  }

  function renderActions () {
    if (isEditing) {
      return [
        <CheckOutlined
          className='mg1r pointer icon-success'
          onClick={handleToggleEdit}
          key='confirm-ssh-config-item'
        />,
        <CloseOutlined
          className='mg1r pointer icon-warning'
          onClick={handleCancelEdit}
          key='cancel-ssh-config-item'
        />
      ]
    }
    return [
      <EditOutlined
        className='mg1r pointer ssh-config-item-edit-icon'
        onClick={handleToggleEdit}
        key='edit-ssh-config-item'
      />,
      <DeleteOutlined
        className='pointer icon-danger ssh-config-item-delete-icon'
        onClick={handleDelete}
        key='del-ssh-config-item'
      />
    ]
  }

  function renderContent () {
    if (isEditing) {
      return (
        <TextArea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          rows={10}
          className='mg1t'
        />
      )
    }
    return (
      <pre className='ssh-config-item-content'>
        {JSON.stringify(item, null, 2)}
      </pre>
    )
  }

  return (
    <div className='ssh-config-item pd1'>
      <div className='pd1b ssh-config-item-header'>
        <b className='mg1r'>[{index + 1}]</b>
        {renderActions()}
      </div>
      {renderContent()}
    </div>
  )
}
