import {
  Form,
  Input,
  Table
} from 'antd'
import {
  tailFormItemLayout
} from '../../../common/form-layout'
import {
  MinusCircleFilled,
  EditOutlined,
  HolderOutlined
} from '@ant-design/icons'
import uid from '../../../common/uid'
import {
  authTypeMap,
  connectionHoppingWarnKey
} from '../../../common/constants'
import { useState, useRef, useCallback } from 'react'
import { isDropAfterHalf } from '../../../common/drop-position'
import ConnectionHoppingWarningText from '../../common/connection-hopping-warning-text'
import * as ls from '../../../common/safe-local-storage'
import Modal from '../../common/modal'
import ConnectionHoppingForm from './connection-hopping-form'

const FormItem = Form.Item
const e = window.translate

export default function renderConnectionHopping (props) {
  const {
    store,
    form,
    formData
  } = props
  const [formChild] = Form.useForm()
  const [editFormChild] = Form.useForm()
  const [initialValues] = useState({
    port: 22,
    authType: authTypeMap.password
  })
  const [showWarn, setShowWarn] = useState(
    window.store.hasOldConnectionHoppingBookmark && ls.getItem(connectionHoppingWarnKey) !== 'yes'
  )
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState(null)

  function closeWarn () {
    setShowWarn(false)
  }
  const [list, setList] = useState(formData.connectionHoppings || [])
  const dragItem = useRef(null)
  const dragOverItem = useRef(null)
  // tracks whether the pointer is in the bottom half of the hovered row,
  // so a drop can land after the target (including after the last row).
  const dragOverAfter = useRef(false)
  // { index, after } of the row currently hovered, or null. Drives the
  // directional drop indicator on the antd table row via a className.
  const [overRow, setOverRow] = useState(null)

  const handleDragStart = useCallback((index) => {
    dragItem.current = index
  }, [])

  // track target index + before/after half on every drag-over pass,
  // because onDragEnter only fires once per row and cannot detect
  // moving between the top and bottom half of the same row.
  const handleDragOver = useCallback((e, index) => {
    e.preventDefault()
    const after = isDropAfterHalf(e, e.currentTarget)
    dragOverItem.current = index
    dragOverAfter.current = after
    setOverRow({ index, after })
  }, [])

  const handleDragEnd = useCallback(() => {
    setOverRow(null)
    if (dragItem.current === null || dragOverItem.current === null) {
      return
    }
    if (dragItem.current === dragOverItem.current) {
      dragItem.current = null
      dragOverItem.current = null
      dragOverAfter.current = false
      return
    }
    setList(old => {
      const newList = [...old]
      const fromIndex = dragItem.current
      let insertIndex = dragOverAfter.current
        ? dragOverItem.current + 1
        : dragOverItem.current
      const [removed] = newList.splice(fromIndex, 1)
      if (fromIndex < insertIndex) {
        insertIndex = insertIndex - 1
      }
      newList.splice(insertIndex, 0, removed)
      form.setFieldsValue({
        connectionHoppings: newList
      })
      dragItem.current = null
      dragOverItem.current = null
      dragOverAfter.current = false
      return newList
    })
  }, [form])

  function handleFinish (data) {
    const nd = {
      ...data,
      id: uid()
    }
    const v = [
      ...(form.getFieldValue('connectionHoppings') || []),
      nd
    ]
    form.setFieldsValue({
      connectionHoppings: v
    })
    setList(old => {
      return [
        ...old,
        nd
      ]
    })
    formChild.resetFields()
  }

  function remove (id) {
    setList(old => {
      return old.filter(i => i.id !== id)
    })
    const v = (form.getFieldValue('connectionHoppings') || []).filter(i => i.id !== id)
    form.setFieldsValue({
      connectionHoppings: v
    })
    formChild.resetFields()
  }

  function openEdit (record) {
    setEditingItem(record)
    setEditModalVisible(true)
    setTimeout(() => {
      editFormChild.setFieldsValue(record)
    }, 100)
  }

  function handleEditFinish (data) {
    const updatedItem = {
      ...data,
      id: editingItem.id
    }
    setList(old => {
      return old.map(item => item.id === editingItem.id ? updatedItem : item)
    })
    const v = (form.getFieldValue('connectionHoppings') || []).map(
      item => item.id === editingItem.id ? updatedItem : item
    )
    form.setFieldsValue({
      connectionHoppings: v
    })
    setEditModalVisible(false)
    setEditingItem(null)
    editFormChild.resetFields()
  }

  function closeEditModal () {
    setEditModalVisible(false)
    setEditingItem(null)
    editFormChild.resetFields()
  }

  const cols = [
    {
      title: '',
      key: 'drag',
      width: 30,
      render: () => (
        <HolderOutlined
          className='drag'
        />
      )
    },
    {
      title: 'NO.',
      dataIndex: 'index',
      key: 'index',
      render: (k) => k
    }, {
      title: e('connectionHopping'),
      key: 'connectionHopping',
      render: (k, item) => {
        const pass = item.password ? ':*****' : ''
        const ph = item.passphase ? '(passphase:*****)' : ''
        const pk = item.privateKey ? '(privateKey:*****)' : ''
        const useProfile = item.profile ? '[profile] ' : ''
        return <span>{useProfile}{item.username}{pass}@{item.host}:{item.port}{pk}{ph}</span>
      }
    }, {
      title: e('op'),
      key: 'op',
      dataIndex: 'id',
      render: (id, record) => {
        return (
          <span>
            <EditOutlined
              className='pointer mg1r'
              onClick={() => openEdit(record)}
            />
            <MinusCircleFilled
              className='pointer'
              onClick={() => remove(id)}
            />
          </span>
        )
      }
    }
  ]

  function renderPaths () {
    return [
      '👤',
      ...list.map(d => d.host),
      form.getFieldValue('host')
    ].join(' -> ')
  }

  function renderList () {
    return (
      <FormItem {...tailFormItemLayout}>
        <Table
          columns={cols}
          className='mg3b connection-hopping-table'
          pagination={false}
          size='small'
          onRow={(record, index) => ({
            draggable: true,
            className: overRow && overRow.index === index
              ? (overRow.after ? 'dnd-after' : 'dnd-before')
              : '',
            onDragStart: () => handleDragStart(index),
            onDragOver: (e) => handleDragOver(e, index),
            onDragEnd: handleDragEnd
          })}
          dataSource={list.map((d, i) => {
            return {
              ...d,
              index: i + 1
            }
          })}
        />
        {renderPaths()}
      </FormItem>
    )
  }
  function renderWarn () {
    if (!showWarn) {
      return null
    }
    return (
      <FormItem {...tailFormItemLayout}>
        <ConnectionHoppingWarningText closeWarn={closeWarn} />
      </FormItem>
    )
  }

  const editModalProps = {
    open: editModalVisible,
    onCancel: closeEditModal,
    footer: null,
    title: e('edit') + ' ' + e('connectionHopping'),
    width: 600
  }

  return (
    <>
      <FormItem
        name='connectionHoppings'
        className='hide'
      >
        <Input />
      </FormItem>
      {renderList()}
      {renderWarn()}
      <ConnectionHoppingForm
        store={store}
        formChild={formChild}
        initialValues={initialValues}
        onFinish={handleFinish}
        authTypes={props.authTypes}
        trim={props.trim}
      />
      {editModalVisible && (
        <Modal {...editModalProps}>
          <ConnectionHoppingForm
            key={editingItem?.id}
            store={store}
            formChild={editFormChild}
            initialValues={editingItem}
            onFinish={handleEditFinish}
            authTypes={props.authTypes}
            trim={props.trim}
            isEdit
          />
        </Modal>
      )}
    </>
  )
}
