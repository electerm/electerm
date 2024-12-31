import { Tooltip } from 'antd'

export default function SshConfigItem (props) {
  const { item } = props

  const generateTooltipContent = (item) => {
    return Object.entries(item)
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => (
        <div key={key}>
          <b className='mg1r'>{key}:</b>
          <span>{value}</span>
        </div>
      ))
  }

  return (
    <Tooltip title={generateTooltipContent(item)}>
      <div>
        <div className='elli pd1y pd2x'>
          ssh {item.title}
        </div>
      </div>
    </Tooltip>
  )
}
