import {
  Checkbox
} from 'antd'

export default function DataSelectItem (props) {
  const {
    title,
    checked,
    value,
    onChange
  } = props
  const boxProps = {
    checked,
    onChange,
    'data-key': value
  }
  return (
    <Checkbox
      key={value}
      {...boxProps}
    >
      {title}
    </Checkbox>
  )
}
