import { useState } from 'react'
import { Textarea, Tooltip } from 'antd'
import {
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons'

const e = window.translate

export default function LoadSshConfigsItem (props) {
  const { item, index, onDelete, onUpdate } = props
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(JSON.stringify(item, null, 2))
  const [isHovered, setIsHovered] = useState(false)

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

  return (
    <div
      className='ssh-config-item pd1y pd1x'
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className='ssh-config-item-header flex-between'>
        <span className='ssh-config-item-index'>[{index + 1}]</span>
        <div className='ssh-config-item-actions'>
          {isEditing
            ? (
              <>
                <Tooltip title={e('ok')}>
                  <CheckOutlined
                    className='mg1r pointer icon-success'
                    onClick={handleToggleEdit}
                  />
                </Tooltip>
                <Tooltip title={e('cancel')}>
                  <CloseOutlined
                    className='mg1r pointer icon-warning'
                    onClick={handleCancelEdit}
                  />
                </Tooltip>
              </>
              )
            : (
              <>
                <Tooltip title={e('edit')}>
                  <EditOutlined
                    className='mg1r pointer'
                    style={{ opacity: isHovered ? 1 : 0 }}
                    onClick={handleToggleEdit}
                  />
                </Tooltip>
                <Tooltip title={e('delete')}>
                  <DeleteOutlined
                    className='pointer icon-danger'
                    style={{ opacity: isHovered ? 1 : 0 }}
                    onClick={handleDelete}
                  />
                </Tooltip>
              </>
              )}
        </div>
      </div>
      {isEditing
        ? (
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={10}
            className='mg1t'
          />
          )
        : (
          <pre className='ssh-config-item-content'>
            {JSON.stringify(item, null, 2)}
          </pre>
          )}
    </div>
  )
}
