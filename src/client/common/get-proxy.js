export default function (tab, conf) {
  if (tab.proxy && typeof tab.proxy === 'string') {
    return tab.proxy
  } else if (conf.enableGlobalProxy && conf.proxy && typeof conf.proxy === 'string') {
    return conf.proxy
  }
  return ''
}
