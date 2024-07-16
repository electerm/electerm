import { copy } from '../../common/clipboard'
import filesizeParser from 'filesize-parser'
import { formatBytes } from '../../common/byte-format'

const valueParserMaps = {
  size: v => v,
  used: filesizeParser,
  avail: filesizeParser,
  usedPercent: v => parseFloat(v.replace('%', ''))
}

function valueParse (obj, k) {
  if (valueParserMaps[k]) {
    return valueParserMaps[k](obj[k])
  }
  return obj[k]
}

function copyValue (event) {
  copy(event.target.getAttribute('data-content'))
}

export default (data) => {
  return Object.keys(data).map(k => {
    const rd = (txt) => {
      const r = k === 'mem' ? formatBytes(parseInt(txt, 10)) : txt
      const itemProps = {
        className: 'activity-item pointer',
        'data-content': r,
        onClick: copyValue
      }
      return (
        <div
          {...itemProps}
        >
          {r}
        </div>
      )
    }
    return {
      title: k,
      dataIndex: k,
      key: k,
      sorter: (a, b) => {
        const va = valueParse(a, k)
        const vb = valueParse(b, k)
        return va > vb ? 1 : -1
      },
      render: rd
    }
  })
}
