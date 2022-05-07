import { copy } from '../../common/clipboard'
import filesizeParser from 'filesize-parser'

const { prefix } = window
const m = prefix('menu')

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

export default (data) => {
  return Object.keys(data).map(k => {
    return {
      title: k,
      dataIndex: k,
      key: k,
      sorter: (a, b) => {
        const va = valueParse(a, k)
        const vb = valueParse(b, k)
        return va > vb ? 1 : -1
      },
      render: (txt) => {
        return (
          <div className='activity-item'>
            <span>{txt}</span>
            <span
              className='pointer activity-item-copy mg1l bold color-blue'
              onClick={() => copy(txt)}
            >
              {m('copy')}
            </span>
          </div>
        )
      }
    }
  })
}
