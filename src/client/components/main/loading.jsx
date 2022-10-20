import LogoElelm from '../common/logo-elem'
import { PureComponent } from 'react'

export class LoadingUI extends PureComponent {
  state = {
    show: true
  }

  componentDidMount () {
    setTimeout(this.hide, 5000)
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
