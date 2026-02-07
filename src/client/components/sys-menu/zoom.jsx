import ZoomControl from '../common/zoom-control'

export default function ZoomMenu (props) {
  const { store } = window
  return (
    <ZoomControl
      value={props.config.zoom}
      onChange={(v) => store.zoom(v)}
    />
  )
}
