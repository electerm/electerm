import LogoElelm from '../common/logo-elem'
import { PureComponent } from 'react'

export class LoadingUI extends PureComponent {
  state = {
    show: true
  }

  // componentDidMount () {
  //   setTimeout(this.hide, 5000)
  // }

  componentDidUpdate (prevProps) {
    Object.keys(this.props).some(key => {
      if (key.startsWith('terminalBackground') && prevProps[key] !== this.props[key]) {
        this.updateCss()
        return true
      }
    })
    if (!prevProps.wsInited && this.props.wsInited) {
      this.hide()
    }
  }

  hide = () => {
    this.setState({
      show: false
    })
  }

  render () {
    if (!this.state.show) {
      return null
    }
    return (
      <div className='loading-data'>
        <LogoElelm />
      </div>
    )
  }
}
