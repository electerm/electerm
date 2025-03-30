import {
  InputNumber
} from 'antd'
import { isNumber, isNaN } from 'lodash-es'

export default function NumberConfig ({
  min,
  max,
  cls,
  title = '',
  value,
  defaultValue,
  onChange,
  step,
  extraDesc,
  width = 136
}) {
  const opts = {
    step,
    value,
    min,
    max,
    onChange,
    placeholder: defaultValue
  }
  if (title) {
    opts.formatter = v => `${title}${extraDesc || ''}: ${v}`
    opts.parser = (v) => {
      let vv = isNumber(v)
        ? v
        : Number(v.split(': ')[1], 10)
      if (isNaN(vv)) {
        vv = defaultValue
      }
      return vv
    }
    opts.style = {
      width: width + 'px'
    }
  }
  return (
    <div className={`pd2b ${cls || ''}`}>
      <InputNumber
        {...opts}
      />
    </div>
  )
}
