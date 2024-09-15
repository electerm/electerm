import { ColorPicker } from '../bookmark-form/color-picker'

export default function ThemeEditSlot (props) {
  const {
    name,
    value,
    disabled
  } = props
  function onChange (v) {
    props.onChange(v, name)
  }
  const pickerProps = {
    value,
    onChange,
    isRgba: value.startsWith('rgba'),
    disabled
  }
  return (
    <div className='theme-edit-slot'>
      <span className='iblock mg1r'>{name}</span>
      <span className='iblock'>
        <ColorPicker
          {...pickerProps}
        />
      </span>
    </div>
  )
}
