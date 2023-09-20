import { Component } from '../common/react-subx'
import InputNumberConfirm from '../common/input-confirm'

import {
  MinusCircleOutlined,
  PlusCircleOutlined
} from '@ant-design/icons'

export default class ZoomMenu extends Component {
  handleChange = (v) => {
    const { store } = this.props
    store.zoom(v / 100)
  }

  render () {
    const { store } = this.props
    return (
      <InputNumberConfirm
        value={parseInt(store.config.zoom * 100, 10)}
        onChange={this.handleChange}
        step={1}
        min={25}
        max={500}
        addonAfter='%'
        addonBefore={
          <div>
            <PlusCircleOutlined
              onClick={() => store.zoom(0.25, true)}
              className='mg1r pointer font16'
            />
            <MinusCircleOutlined
              onClick={() => store.zoom(-0.25, true)}
              className='pointer font16'
            />
          </div>
        }
      />
    )
  }
}
