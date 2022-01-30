/**
 * two column layout, left column fixed with, right column auto width
 */

export default function SettingCol (props) {
  const style = {
    minHeight: (window.innerHeight - 150) + 'px'
  }
  return (
    <div className='setting-col'>
      <div className='setting-row-left' style={style}>
        {props.children[0]}
      </div>
      <div
        className='setting-row-right'
        style={style}
      >
        {props.children[1]}
      </div>
    </div>
  )
}
