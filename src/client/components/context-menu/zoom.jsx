import { Component } from '../common/react-subx'
import { Button, InputNumber, Space } from 'antd'

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
      <Space.Compact size='small'>
        <Button onClick={() => store.zoom(0.25, true)}>
          <PlusCircleOutlined />
        </Button>
        <Button onClick={() => store.zoom(-0.25, true)}>
          <MinusCircleOutlined />
        </Button>
        <InputNumber
          value={store.config.zoom * 100}
          onChange={this.handleChange}
          step={1}
          min={25}
          max={500}
          addonAfter='%'
        />
      </Space.Compact>
    )
  }
}
