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
        <span className='mg1r iblock'>
          {store.config.zoom * 100}
        </span>
        <Button onClick={() => store.zoom(0.25, true)}>
          <PlusCircleOutlined />
        </Button>
        <Button onClick={() => store.zoom(-0.25, true)}>
          <MinusCircleOutlined />
        </Button>
        <Button onClick={() => store.zoom()}>
          100%
        </Button>
      </Group>
    )
  }
}
