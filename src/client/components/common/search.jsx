/**
 * common search with clear icon
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { Input, Icon } from 'antd'

const { Search } = Input

export default class CommonSearch extends React.PureComponent {
  componentDidUpdate (prevProps) {
    if (prevProps.value !== this.props.value) {
      const root = ReactDOM.findDOMNode(this)
      root.querySelector('input').focus()
    }
  }

  clear = () => {
    const { onChange } = this.props
    onChange && onChange({
      target: {
        value: ''
      }
    })
  }

  render () {
    const { className, style, ...rest } = this.props
    let Dom = Search
    if (!rest.suffix && rest.value) {
      rest.suffix = (
        <Icon
          type='close'
          className='pointer'
          onClick={this.clear}
          title='clear'
        />
      )
      Dom = Input
    }
    const dom = (
      <Dom
        {...rest}
      />
    )
    return (
      <div {...{ className, style }}>
        {dom}
      </div>
    )
  }
}
