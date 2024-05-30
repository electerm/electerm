import { PureComponent } from 'react'
import ProfileCommandForm from './profile-form-elem'
import { LoadingOutlined } from '@ant-design/icons'

export default class ProfleFormIndex extends PureComponent {
  state = {
    ready: false
  }

  componentDidMount () {
    this.timer = setTimeout(() => {
      this.setState({
        ready: true
      })
    }, 200)
  }

  componentWillUnmount () {
    clearTimeout(this.timer)
  }

  render () {
    const { ready } = this.state
    if (!ready) {
      return (
        <div className='pd3 aligncenter'>
          <LoadingOutlined />
        </div>
      )
    }
    return <ProfileCommandForm {...this.props} />
  }
}
