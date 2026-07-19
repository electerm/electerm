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
  Pagination,
  Modal,
  Space,
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

  handlePageChange = (page, pageSize) => {
    this.setState({
      pagination: { current: page, pageSize }
    })
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

  renderItem = (record) => {
    const { password, count, titles } = record
    const display = titles.length > 2
      ? `${titles.slice(0, 2).join(', ')}... (+${titles.length - 2})`
      : titles.join(', ')
    const copyProps = {
      type: 'text',
      icon: <CopyOutlined />,
      onClick: () => this.handleCopyPassword(password)
    }
    const editProps = {
      type: 'text',
      icon: <EditOutlined />,
      onClick: () => this.showEditModal(record)
    }
    return (
      <div className='setting-passwords-item' key={password}>
        <div className='setting-passwords-item-inner'>
          <Space className='setting-passwords-pwd-cell'>
            <KeyOutlined />
            <TextAnt keyboard>********</TextAnt>
          </Space>
          <Tag color='blue' className='setting-passwords-count-cell'>{count}</Tag>
          <Tooltip title={titles.join('\n')}>
            <span className='setting-passwords-host-cell'>{display}</span>
          </Tooltip>
          <Space className='setting-passwords-actions-cell'>
            <Tooltip title={e('copy')}>
              <Button {...copyProps} />
            </Tooltip>
            <Tooltip title={e('changePassword')}>
              <Button {...editProps} />
            </Tooltip>
          </Space>
        </div>
      </div>
    )
  }

  renderContent () {
    const { search, pagination } = this.state
    const { current, pageSize } = pagination
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

    // clamp current page when filtering shrinks the data set
    const pageCount = Math.ceil(data.length / pageSize)
    const safePage = Math.min(current, Math.max(pageCount, 1))
    const pagedData = data.slice((safePage - 1) * pageSize, safePage * pageSize)

    const paginationProps0 = {
      total: data.length,
      current: safePage,
      pageSize,
      showSizeChanger: true,
      onChange: this.handlePageChange,
      onShowSizeChange: this.handlePageChange,
      size: 'small'
    }

    return (
      <div>
        <Search {...searchProps0} />
        <div className='setting-passwords-list'>
          {pagedData.map(item => this.renderItem(item))}
        </div>
        <Pagination {...paginationProps0} />
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
