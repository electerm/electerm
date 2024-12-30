export default function SshConfigItem (props) {
  const {
    item
  } = props
  return (
    <div
      className='item-list-unit'
    >
      <div className='elli pd1y pd2x'>
        ssh {item.title}
      </div>
    </div>
  )
}
