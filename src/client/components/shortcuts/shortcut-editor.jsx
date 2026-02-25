import { PureComponent, createRef } from 'react'
import {
  Button,
  Input
} from 'antd'
import message from '../common/message'
import {
  EditFilled,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons'
import { throttle } from 'lodash-es'
import { getKeyCharacter } from './get-key-char.js'

export default class ShortcutEdit extends PureComponent {
  state = {
    editMode: false,
    shortcut: '',
    data: null
  }

  containerRef = createRef()

  componentWillUnmount () {
    this.removeEventListener()
  }

  addEventListener = () => {
    document.addEventListener('click', this.handleClickOuter, true)
    document.addEventListener('keydown', this.handleKeyDown)
    document.addEventListener('mousewheel', this.handleKeyDown)
  }

  removeEventListener = () => {
    document.removeEventListener('click', this.handleClickOuter, true)
    document.removeEventListener('keydown', this.handleKeyDown)
    document.removeEventListener('mousewheel', this.handleKeyDown)
  }

  handleClickOuter = (e) => {
    const container = this.containerRef.current
    if (container && !container.contains(e.target)) {
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

  warnCtrolKey = throttle(() => {
    message.info(
      'Must have one of Ctrl or Shift or Alt or Meta key',
      undefined
    )
  }, 3000)

  warnExist = throttle(() => {
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
      altKey,
      wheelDeltaY
    } = e
    e.preventDefault()
    e.stopPropagation()
    const codeName = e instanceof window.WheelEvent
      ? (wheelDeltaY > 0 ? 'mouseWheelUp' : 'mouseWheelDown')
      : code
    const codeK = getKeyCharacter(codeName)
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

  renderStatic () {
    const {
      shortcut
    } = this.props.data
    return (
      <Button
        className='edit-shortcut-button'
      >
        <span>{shortcut}</span>
        <EditFilled
          className='shortcut-edit-icon pointer mg1l'
          onClick={this.handleEditClick}
        />
        {
          this.renderClear()
        }
      </Button>
    )
  }

  renderClear () {
    if (this.props.renderClear && this.props.data.shortcut) {
      return (
        <CloseOutlined
          className='pointer mg1l'
          onClick={this.props.handleClear}
        />
      )
    }
  }

  renderAfter () {
    const {
      shortcut
    } = this.state
    if (!shortcut) {
      return null
    }
    return (
      <>
        <CheckOutlined
          onClick={this.handleConfirm}
          className='pointer'
        />
        <CloseOutlined
          onClick={this.handleCancel}
          className='pointer mg1l'
        />
      </>
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
      <div ref={this.containerRef}>
        <Input
          suffix={this.renderAfter()}
          value={shortcut}
          className='shortcut-input'
        />
      </div>
    )
  }
}
