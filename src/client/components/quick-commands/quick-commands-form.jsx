import { PureComponent } from 'react'
import QuickCommandForm from './quick-commands-form-elem'
import { Loader2 } from 'lucide-react'

export default class QuickCommandFormIndex extends PureComponent {
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
    return <QuickCommandForm {...this.props} />
  }
}
