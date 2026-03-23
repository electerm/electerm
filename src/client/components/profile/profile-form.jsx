import { PureComponent } from 'react'
import ProfileCommandForm from './profile-form-elem'
import { Loader2 } from 'lucide-react'

export default class ProfleFormIndex extends PureComponent {
  state = {
    ready: false
  }

  componentDidMount () {
    this.timer = setTimeout(() => {
      this.setState({
        ready: true
      })
    }, 0)
  }

  componentWillUnmount () {
    clearTimeout(this.timer)
  }

  render () {
    const { ready } = this.state
    if (!ready) {
      return (
        <div className='pd3 aligncenter'>
          <Loader2 />
        </div>
      )
    }
    return <ProfileCommandForm {...this.props} />
  }
}
