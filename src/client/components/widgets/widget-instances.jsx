import WidgetInstance from './widget-instance'

export default function WidgetInstances ({ widgetInstances }) {
  return widgetInstances.map(item => (
    <WidgetInstance
      key={item.id}
      item={item}
    />
  ))
}
