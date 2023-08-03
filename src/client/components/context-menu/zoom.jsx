import { Component } from '../common/react-subx'
import { Button } from 'antd'

import {
  MinusCircleOutlined,
  PlusCircleOutlined
} from '@ant-design/icons'

const { Group } = Button

export default class ZoomMenu extends Component {
  render () {
    const { store } = this.props
    return (
      <Group size='small'>
        <Button onClick={() => store.zoom(0.25, true)}>
          <PlusCircleOutlined />
        </Button>
        <Button onClick={() => store.zoom(-0.25, true)}>
          <MinusCircleOutlined />
        </Button>
        <Button onClick={() => store.zoom()}>
          {store.config.zoom * 100}%
        </Button>
      </Group>
    )
  }
}
