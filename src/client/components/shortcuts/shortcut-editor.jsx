import { PureComponent } from 'react'
import {
  Button,
  Input,
  message
} from 'antd'
import {
  EditFilled,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons'
import { debounce } from 'lodash-es'
import { getKeyCharacter } from './get-key-char.js'

export default class ShortcutEdit extends PureComponent {
  state = {
    editMode: false,
    shortcut: '',
    data: null
  }

  addEventListener = () => {
    const elem = document.querySelector('.ant-drawer')
    elem?.addEventListener('click', this.handleClickOuter)
    document.addEventListener('keydown', this.handleKeyDown)
  }

  removeEventListener = () => {
    const elem = document.querySelector('.ant-drawer')
    elem?.removeEventListener('click', this.handleClickOuter)
    document.removeEventListener('keydown', this.handleKeyDown)
  }

  isInsideElement = (event) => {
    const { target } = event
    const cls = this.getCls()
    if (!target || !target.classList) {
      return false
    } else if (target.classList.contains(cls)) {
      return true
    } else {
      const parent = target.parentElement
      if (parent !== null) {
        return this.isInsideElement({ target: parent })
      } else {
        return false
      }
    }
  }

  handleClickOuter = (e) => {
    if (!this.isInsideElement(e)) {
      this.handleCancel()
    }
  }

  handleEditClick = () => {
    this.setState({
      editMode: true
    }, this.addEventListener)
  }

  handleCancel = () => {
    this.setState({
      editMode: false
    }, this.removeEventListener)
  }

  handleConfirm = () => {
    const {
      name
    } = this.props.data
    this.props.updateConfig(
      name, this.state.shortcut
    )
    this.handleCancel()
  }

  getCls = () => {
    const { index } = this.props.data
    return 'shortcut-control-' + index
  }

  warnCtrolKey = debounce(() => {
    message.info(
      'Must have one of Ctrl or Shift or Alt or Meta key',
      undefined
    )
  }, 3000)

  warnExist = debounce(() => {
    message.info(
      'Shortcut already exists',
      undefined
    )
  }, 3000)

  handleKeyDown = (e) => {
    const {
      code,
      ctrlKey,
      shiftKey,
      metaKey,
      altKey
    } = e
    const codeK = getKeyCharacter(code)
    const noControlKey = !ctrlKey && !shiftKey && !metaKey && !altKey
    if (noControlKey && codeK === 'Escape') {
      return this.handleCancel()
    } else if (noControlKey) {
      return this.warnCtrolKey()
    }
    const r = (ctrlKey ? 'ctrl+' : '') +
      (metaKey ? 'meta+' : '') +
      (shiftKey ? 'shift+' : '') +
      (altKey ? 'alt+' : '') +
      codeK.toLowerCase()
    if (this.props.keysTaken[r]) {
      return this.warnExist()
    }
    this.setState({
      shortcut: r
    })
  }

  handleClickOutside = () => {
    this.removeEventListener()
    this.setState({
      editMode: false
    })
  }

  renderStatic () {
    const {
      shortcut
    } = this.props.data
    return (
      <Button
        className='edit-shortcut-button'
        onClick={this.handleEditClick}
      >
        <span>{shortcut}</span>
        <EditFilled
          className='shortcut-edit-icon pointer mg1l'
        />
      </Button>
    )
  }

  renderAfter () {
    const {
      shortcut
    } = this.state
    if (!shortcut) {
      return null
    }
    return (
      <div>
        <CheckOutlined
          onClick={this.handleConfirm}
          className='pointer'
        />
        <CloseOutlined
          onClick={this.handleCancel}
          className='pointer mg1l'
        />
      </div>
    )
  }

  render () {
    const {
      shortcut,
      editMode
    } = this.state
    if (!editMode) {
      return this.renderStatic()
    }
    return (
      <div className={this.getCls()}>
        <Input
          addonAfter={this.renderAfter()}
          value={shortcut}
        />
      </div>
    )
  }
}
