import InputNumberConfirm from '../common/input-confirm'

import {
  MinusCircleOutlined,
  PlusCircleOutlined
} from '@ant-design/icons'

export default function ZoomMenu (props) {
  const { store } = window
  const handleChange = (v) => {
    store.zoom(v / 100)
  }

  return (
    <InputNumberConfirm
      value={parseInt(props.config.zoom * 100, 10)}
      onChange={handleChange}
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
