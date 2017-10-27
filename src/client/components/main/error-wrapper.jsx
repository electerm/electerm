import React from 'react'

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
          <h1>Something went wrong.</h1>
          <div className="pd1y">{message}</div>
          <div className="pd1y">{stack}</div>
        </div>
      )
    }
    return this.props.children
  }
}
