import {
  Form,
  Input,
  Table
} from 'antd'
import { useState } from 'react'
import { MinusCircleFilled, EditOutlined } from '@ant-design/icons'
import { tailFormItemLayout } from '../../../common/form-layout'
import uid from '../../../common/uid'
import Modal from '../../common/modal'
import SshTunnelForm from './ssh-tunnel-form'

const FormItem = Form.Item
const e = window.translate

const defaultInitialValues = {
  sshTunnel: 'forwardRemoteToLocal',
  sshTunnelLocalPort: 12200,
  sshTunnelLocalHost: '127.0.0.1',
  sshTunnelRemotePort: 12300,
  sshTunnelRemoteHost: '127.0.0.1'
}

export default function renderSshTunnels (props) {
  const {
    form,
    formData
  } = props
  const [formChild] = Form.useForm()
  const [editFormChild] = Form.useForm()
  const [initialValues] = useState(defaultInitialValues)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [list, setList] = useState(formData.sshTunnels || [])
  function handleFinish (data) {
    const nd = {
      ...data,
      id: uid()
    }
    const v = [
      ...(form.getFieldValue('sshTunnels') || []),
      nd
    ]
    form.setFieldsValue({
      sshTunnels: v
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
    const v = (form.getFieldValue('sshTunnels') || []).filter(i => i.id !== id)
    form.setFieldsValue({
      sshTunnels: v
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
    setList(old => old.map(item => item.id === editingItem.id ? updatedItem : item))
    const v = (form.getFieldValue('sshTunnels') || []).map(
      item => item.id === editingItem.id ? updatedItem : item
    )
    form.setFieldsValue({
      sshTunnels: v
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
      title: 'NO.',
      dataIndex: 'index',
      key: 'index',
      render: (k) => k
    }, {
      title: e('sshTunnel'),
      key: 'sshTunnel',
      render: (k, item) => {
        // sshTunnel is forwardRemoteToLocal or forwardLocalToRemote or dynamicForward
        const {
          sshTunnel,
          sshTunnelRemoteHost = '127.0.0.1',
          sshTunnelRemotePort = '',
          sshTunnelLocalHost = '127.0.0.1',
          sshTunnelLocalPort = '',
          name
        } = item
        if (sshTunnel === 'dynamicForward') {
          const n = name ? `[${name}] ` : ''
          return `${n}socks5://${sshTunnelLocalHost}:${sshTunnelLocalPort}`
        }
        const to = sshTunnel === 'forwardRemoteToLocal'
          ? `${e('local')}:${sshTunnelLocalHost}:${sshTunnelLocalPort}`
          : `${e('remote')}:${sshTunnelRemoteHost}:${sshTunnelRemotePort}`
        const from = sshTunnel === 'forwardRemoteToLocal'
          ? `${e('remote')}:${sshTunnelRemoteHost}:${sshTunnelRemotePort}`
          : `${e('local')}:${sshTunnelLocalHost}:${sshTunnelLocalPort}`
        return (
          <span>
            {name ? `[${name}] ` : ''}→ {from} → {to}
          </span>
        )
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

  function renderList () {
    return (
      <FormItem {...tailFormItemLayout}>
        <Table
          columns={cols}
          className='mg3b'
          pagination={false}
          size='small'
          dataSource={list.map((d, i) => {
            return {
              ...d,
              index: i + 1
            }
          })}
        />
      </FormItem>
    )
  }

  return (
    <>
      <FormItem
        name='sshTunnels'
        className='hide'
      >
        <Input />
      </FormItem>
      {renderList()}
      <SshTunnelForm
        formChild={formChild}
        initialValues={initialValues}
        onFinish={handleFinish}
      />
      {editModalVisible && (
        <Modal
          open={editModalVisible}
          onCancel={closeEditModal}
          footer={null}
          title={e('edit') + ' ' + e('sshTunnel')}
          width={600}
        >
          <SshTunnelForm
            key={editingItem?.id}
            formChild={editFormChild}
            initialValues={editingItem}
            onFinish={handleEditFinish}
            isEdit
          />
        </Modal>
      )}
    </>
  )
}
