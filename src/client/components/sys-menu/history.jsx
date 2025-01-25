import HistoryItem from '../sidebar/history-item'

export default function HistorySubMenu (props) {
  return (
    <div className='sub-context-menu'>
      {
        props.history.map(item => {
          return (
            <HistoryItem key={item.id} item={item} />
          )
        })
      }
    </div>
  )
}
