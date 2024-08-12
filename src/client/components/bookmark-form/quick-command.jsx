/**
 * quick command list
 */

import { PureComponent } from 'react'
import { CheckOutlined, CloseCircleOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons'
import {
  Input,
  Col,
  Row,
  message,
  Switch,
  Tooltip,
  Space
} from 'antd'
import { settingMap } from '../../common/constants'
import generate from '../../common/uid'
import eq from 'fast-deep-equal'

const InputGroup = Space.Compact
const e = window.translate

export default class QuickCommandItem extends PureComponent {
  constructor (props) {
    super(props)
    this.state = {
      edit: !props.item.id,
      item: props.item || {}
    }
  }

  componentDidUpdate (prevProps) {
    if (!eq(this.props.item, prevProps.item)) {
      this.setState({
        item: this.props.item
      })
    }
  }

  handleSubmit = () => {
    const {
      name, command, id, inputOnly
    } = this.state.item
    if (!name) {
      return message.warning('name required')
    } else if (!command) {
      return message.warning('command required')
    }
    const quickCommands = this.props.form.getFieldValue(settingMap.quickCommands) || []
    if (id) {
      const qm = quickCommands.find(d => d.id === id)
      if (qm) {
        Object.assign(qm, {
          name, command, inputOnly
        })
      }
      this.setState({
        edit: false
      })
    } else {
      quickCommands.unshift({
        name,
        command,
        inputOnly,
        id: generate()
      })
      this.setState({
        item: {}
      })
    }
    this.props.form.setFieldsValue({
      quickCommands
    })
  }

  handleDel = () => {
    let quickCommands = this.props.form.getFieldValue(settingMap.quickCommands) || []
    quickCommands = quickCommands.filter(d => {
      return d.id !== this.state.item.id
    })
    this.props.form.setFieldsValue({
      quickCommands
    })
  }

  handleEdit = () => {
    this.setState({
      edit: true
    })
  }

  handleCancel = () => {
    this.setState({
      item: this.props.item,
      edit: false
    })
  }

  renderNew = (item) => {
    return <CheckOutlined className='pointer mg1l' onClick={this.handleSubmit} />
  }

  renderIcons = (item) => {
    if (!item.id) {
      return this.renderNew(item)
    }
    return (
      <span>
        <CheckOutlined className='pointer mg1x' onClick={this.handleSubmit} />
        <CloseOutlined className='pointer' onClick={this.handleCancel} />
      </span>
    )
  }

  handleChangeName = e => {
    const v = e.target.value
    this.setState({
      item: {
        ...this.state.item,
        name: v
      }
    })
  }

  handleChangeCommand = e => {
    const v = e.target.value
    this.setState(old => {
      return {
        item: {
          ...old.item,
          command: v
        }
      }
    })
  }

  handleChangeInputOnly = v => {
    this.setState(old => {
      return {
        item: {
          ...old.item,
          inputOnly: v
        }
      }
    })
  }

  renderForm = (item = this.state.item) => {
    return (
      <Row className='mg1t'>
        <Col span={15}>
          <InputGroup>
            <Input
              value={item.name}
              onChange={this.handleChangeName}
              className='width-40'
              title={item.name}
              placeholder={e('quickCommandName')}
            />
            <Input
              value={item.command}
              onChange={this.handleChangeCommand}
              className='width-60'
              placeholder={e('quickCommand')}
              title={item.command}
            />
          </InputGroup>
        </Col>
        <Col span={3}>
          <Tooltip title={e('inputOnly')}>
            <Switch
              checked={!!item.inputOnly}
              onChange={this.handleChangeInputOnly}
            />
          </Tooltip>
        </Col>
        <Col span={6}>
          {this.renderIcons(item)}
        </Col>
      </Row>
    )
  }

  renderItem = (item = this.state.item) => {
    return (
      <Row className='mg1t'>
        <Col span={15}>
          <InputGroup>
            <Input
              value={item.name}
              readOnly
              className='width-40'
              title={item.name}
              placeholder={e('quickCommandName')}
            />
            <Input
              value={item.command}
              readOnly
              className='width-60'
              title={item.command}
            />
          </InputGroup>
        </Col>
        <Col span={3}>
          <Tooltip title={e('inputOnly')}>
            <Switch
              checked={!!item.inputOnly}
              title={e('inputOnly')}
              readOnly
            />
          </Tooltip>
        </Col>
        <Col span={6}>
          <EditOutlined className='pointer font16 mg1x' onClick={this.handleEdit} />
          <CloseCircleOutlined className='pointer font16' onClick={this.handleDel} />
        </Col>
      </Row>
    )
  }

  render () {
    if (this.state.edit) {
      return this.renderForm()
    }
    return this.renderItem()
  }
}
