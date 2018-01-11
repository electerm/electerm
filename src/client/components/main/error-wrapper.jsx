import React from 'react'

const {prefix} = window
const e = prefix('main')

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: {}
    }
  }

  componentDidCatch(error) {
    console.log(new Date() + '', error.stack)
    this.setState({
      hasError: true,
      error
    })
  }

  render() {
    if (this.state.hasError) {
      let {stack, message} = this.state.error
      return (
        <div className="pd3 aligncenter">
          <h1>{e('error')}</h1>
          <div className="pd1y">{message}</div>
          <div className="pd1y">{stack}</div>
        </div>
      )
    }
    return this.props.children
  }
}
