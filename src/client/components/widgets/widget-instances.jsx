import WidgetInstance from './widget-instance'

export default function WidgetInstances ({ widgetInstances, activeItemId, onClickItem }) {
  return widgetInstances.map(item => (
    <WidgetInstance
      key={item.id}
      item={item}
      active={activeItemId === item.id}
      onClick={onClickItem}
    />
  ))
}
