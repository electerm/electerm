/**
 * two column layout, left column fixed with, right column auto width
 */

export default function SettingCol (props) {
  return (
    <div className='setting-col'>
      <div className='setting-row setting-row-left'>
        {props.children[0]}
      </div>
      <div
        className='setting-row setting-row-right'
      >
        {props.children[1]}
      </div>
    </div>
  )
}
