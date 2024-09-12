// import { buildDefaultThemes } from '../../common/terminal-theme'
import ThemeEditSlot from './theme-edit-slot'

export default function ThemeEditor (props) {
  const { themeText, disabled } = props
  const obj = themeText.split('\n').reduce((prev, line) => {
    let [key = '', value = ''] = line.split('=')
    key = key.trim()
    value = value.trim()
    if (!key || !value) {
      return prev
    }
    prev[key] = value
    return prev
  }, {})
  const keys = Object.keys(obj)
  function onChange (value, name) {
    props.onChange(value, name)
  }
  return (
    <div className='editor-u-picker'>
      {
        keys.map(k => {
          return (
            <ThemeEditSlot
              key={k}
              name={k}
              value={obj[k]}
              disabled={disabled}
              onChange={onChange}
            />
          )
        })
      }
    </div>
  )
}
