import { Button, Dropdown, Space } from 'antd'
import BookmarkTransport from '../tree-list/bookmark-transport'
import download from '../../common/download'
import time from '../../common/time'
import { keywordPresets, mergeKeywordPreset } from '../../common/keyword-presets'

const e = window.translate

export default class KeywordsTransport extends BookmarkTransport {
  name = 'keywords-highlight'

  beforeUpload = async (file) => {
    const { store } = this.props
    const txt = file.fileContent !== undefined
      ? file.fileContent
      : await window.fs.readFile(file.filePath)
    try {
      store.setConfig({
        keywords: JSON.parse(txt)
      })
    } catch (e) {
      store.onError(e)
    }
    setTimeout(this.props.resetKeywordForm, 100)
    return false
  }

  handleDownload = () => {
    const { store } = this.props
    const arr = store.config.keywords || []
    const txt = JSON.stringify(arr, null, 2)
    const stamp = time(undefined, 'YYYY-MM-DD-HH-mm-ss')
    download('electerm-' + this.name + '-' + stamp + '.json', txt)
  }

  handleApplyPreset = ({ key }) => {
    const { store } = this.props
    const preset = keywordPresets.find(p => p.name === key)
    if (!preset) {
      return
    }
    store.setConfig({
      keywords: mergeKeywordPreset(store.config.keywords, preset)
    })
    setTimeout(this.props.resetKeywordForm, 100)
  }

  renderPresets () {
    const items = keywordPresets.map(p => ({
      key: p.name,
      label: <span title={p.description}>{p.name}</span>
    }))
    return (
      <Dropdown
        menu={{ items, onClick: this.handleApplyPreset }}
        trigger={['click']}
        key='presets'
      >
        <Button
          title={e('presets')}
          className='keyword-presets-icon'
        >
          {e('presets')}
        </Button>
      </Dropdown>
    )
  }

  render () {
    return (
      <Space.Compact>
        {this.renderExport()}
        {this.renderImport()}
        {this.renderPresets()}
      </Space.Compact>
    )
  }
}
