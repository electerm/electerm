/**
 * input only apply when confirm
 */
import { PureComponent } from 'react'
import {
  CheckOutlined
} from '@ant-design/icons'
import {
  InputNumber
} from 'antd'

export default class InputNumberConfirm extends PureComponent {
  constructor (props) {
    super(props)
    this.state = {
      v: props.value,
      onEdit: false
    }
  }

  componentDidUpdate (prevProps) {
    if (prevProps.value !== this.props.value) {
      this.setState({
        v: this.props.value
      })
    }
  }

  handleChange = (v) => {
    this.setState({ v })
  }

  handleClick = () => {
    this.setState({ onEdit: true })
  }

  handleSubmit = () => {
    this.setState({ onEdit: false })
    this.props.onChange(this.state.v)
  }

  after = () => {
    const { onEdit } = this.state
    if (onEdit) {
      return (
        <CheckOutlined
          className='font16 pointer'
          onClick={this.handleSubmit}
        />
      )
    }
    return this.props.addonAfter
  }

  render () {
    return (
      <InputNumber
        {...this.props}
        value={this.state.v}
        onClick={this.handleClick}
        onChange={this.handleChange}
        addonAfter={this.after()}
      />
    )
  }
}
