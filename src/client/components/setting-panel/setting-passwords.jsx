/**
 * Passwords management component
 * Allows grouping bookmarks by password, changing passwords, and copying passwords
 */
import React, { Component } from 'react'
import {
  CopyOutlined,
  EditOutlined,
  KeyOutlined,
  LaptopOutlined
} from '@ant-design/icons'
import {
  Button,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Input
} from 'antd'
import Search from '../common/search'
import InputConfirm from '../common/input-confirm'
import createTitle from '../../common/create-title'
import { copy as copyToClipboard } from '../../common/clipboard'
import { settingMap } from '../../common/constants'
import './setting.styl'

const { Text: TextAnt } = Typography
const e = window.translate

export default class SettingPasswords extends Component {
  state = {
    passwordGroups: [],
    newPassword: '',
    editModalVisible: false,
    selectedBookmarks: [],
    search: '',
    pagination: {
      current: 1,
      pageSize: 10
    }
  }

  componentDidMount () {
    this.groupBookmarksByPassword()
  }

  groupBookmarksByPassword = () => {
    const { bookmarks = [] } = this.props
    const passwordMap = new Map()

    bookmarks.forEach(bookmark => {
      const pwd = bookmark.password || ''
      if (!pwd) {
        return
      }
      if (!passwordMap.has(pwd)) {
        passwordMap.set(pwd, [])
      }
      passwordMap.get(pwd).push(bookmark)
    })

    const groups = []
    passwordMap.forEach((bookmarksList, password) => {
      groups.push({
        password,
        count: bookmarksList.length,
        bookmarks: bookmarksList,
        titles: bookmarksList.map(b => createTitle(b))
      })
    })

    // Sort by count descending
    groups.sort((a, b) => b.count - a.count)

    this.setState({ passwordGroups: groups })
  }

  handleCopyPassword = (password) => {
    copyToClipboard(password)
  }

  showEditModal = (record) => {
    this.setState({
      newPassword: record.password,
      editModalVisible: true,
      selectedBookmarks: record.bookmarks
    })
  }

  handleEditConfirm = () => {
    const { newPassword, selectedBookmarks } = this.state
    if (!newPassword) {
      return
    }

    const { editItem } = this.props
    selectedBookmarks.forEach(bookmark => {
      editItem(bookmark.id, { password: newPassword }, settingMap.bookmarks)
    })

    this.setState({
      editModalVisible: false,
      newPassword: ''
    })

    this.groupBookmarksByPassword()
  }

  handleEditCancel = () => {
    this.setState({
      editModalVisible: false,
      newPassword: ''
    })
  }

  handlePasswordChange = (newPwd) => {
    this.setState({ newPassword: newPwd }, this.handleEditConfirm)
  }

  handleSearchChange = (evt) => {
    this.setState({
      search: evt.target.value,
      pagination: { ...this.state.pagination, current: 1 }
    })
  }

  handleTableChange = (pagination) => {
    this.setState({ pagination })
  }

  getFilteredData = () => {
    const { passwordGroups, search } = this.state
    if (!search) {
      return passwordGroups
    }
    const keyword = search.toLowerCase()
    return passwordGroups.filter(group => {
      return group.titles.some(title =>
        title.toLowerCase().includes(keyword)
      )
    })
  }

  getColumns = () => {
    const columns = [
      {
        title: e('password'),
        dataIndex: 'password',
        key: 'password',
        render: () => {
          const props0 = {
            children: [
              <KeyOutlined key='icon' />,
              <TextAnt keyboard key='text'>********</TextAnt>
            ]
          }
          return <Space>{props0.children}</Space>
        }
      },
      {
        title: e('count'),
        dataIndex: 'count',
        key: 'count',
        width: 80,
        render: (count) => {
          const props0 = {
            color: 'blue',
            children: count
          }
          return <Tag {...props0} />
        }
      },
      {
        title: e('host'),
        dataIndex: 'titles',
        key: 'host',
        render: (titles) => {
          const display = titles.length > 2
            ? `${titles.slice(0, 2).join(', ')}... (+${titles.length - 2})`
            : titles.join(', ')
          const props0 = {
            title: titles.join('\n'),
            children: <span>{display}</span>
          }
          return <Tooltip {...props0} />
        }
      },
      {
        title: e('actions'),
        key: 'actions',
        width: 80,
        render: (_, record) => {
          const copyProps0 = {
            type: 'text',
            icon: <CopyOutlined />,
            onClick: () => this.handleCopyPassword(record.password)
          }
          const editProps0 = {
            type: 'text',
            icon: <EditOutlined />,
            onClick: () => this.showEditModal(record)
          }
          const copyTooltipProps = {
            title: e('copy'),
            children: <Button {...copyProps0} />
          }
          const editTooltipProps = {
            title: e('changePassword'),
            children: <Button {...editProps0} />
          }
          const spaceProps0 = {
            children: [
              <Tooltip key='copy' {...copyTooltipProps} />,
              <Tooltip key='edit' {...editTooltipProps} />
            ]
          }
          return <Space>{spaceProps0.children}</Space>
        }
      }
    ]
    return columns
  }

  renderContent () {
    const { search, pagination } = this.state
    const data = this.getFilteredData()

    if (data.length === 0) {
      return (
        <div className='setting-passwords-empty'>
          <LaptopOutlined style={{ fontSize: 48, color: '#ccc' }} />
          <p>{e('noPasswordsFound')}</p>
        </div>
      )
    }

    const searchProps0 = {
      value: search,
      onChange: this.handleSearchChange,
      placeholder: e('search')
    }
    const tableProps0 = {
      dataSource: data,
      columns: this.getColumns(),
      rowKey: 'password',
      pagination: { ...pagination, showSizeChanger: true },
      onChange: this.handleTableChange,
      size: 'small'
    }

    return (
      <div>
        <Search {...searchProps0} />
        <Table {...tableProps0} />
      </div>
    )
  }

  render () {
    const { editModalVisible, newPassword, selectedBookmarks } = this.state

    const modalProps0 = {
      title: e('changePassword'),
      open: editModalVisible,
      onCancel: this.handleEditCancel,
      footer: null
    }

    return (
      <div className='setting-passwords'>
        <div className='setting-passwords-header'>
          <h3>
            <KeyOutlined /> {e('passwords')}
          </h3>
        </div>

        {this.renderContent()}

        <Modal {...modalProps0}>
          <div className='password-edit-form'>
            <InputConfirm
              value={newPassword}
              onChange={this.handlePasswordChange}
              placeholder={e('newPassword')}
              inputComponent={Input.Password}
            />
            <div className='affected-bookmarks pd2y'>
              <h3>{e('bookmarks')}</h3>
              {
                selectedBookmarks.map(b => (
                  <p key={b.id}>
                    # {createTitle(b)}
                  </p>
                ))
              }
            </div>
          </div>
        </Modal>
      </div>
    )
  }
}
