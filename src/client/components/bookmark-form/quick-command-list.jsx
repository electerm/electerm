/**
 * quick command list
 */

import QmItem from './quick-command'

export default function QmList (props) {
  const { quickCommands, form } = props
  return (
    <div className='pd3b mg3b'>
      <QmItem
        form={form}
        item={{}}
      />
      {
        quickCommands.map((item, i) => {
          return (
            <QmItem
              form={props.form}
              item={item}
              i={i}
            />
          )
        })
      }
    </div>
  )
}
