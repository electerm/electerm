import { Component } from 'react'

const e = window.translate

class Card extends Component {
  item = []

  constructor (props) {
    super(props)
    this.item = props.item
    console.log(this.item)
  }

  title () {
    return this.item.title || `${this.item.username}@${this.item.host}`
  }

  url () {
    switch (this.item.type) {
      case 'local':
        return null
      case 'web':
        return this.item.url
      case 'telnet':
        return ''
      case undefined:
      case 'ssh':
        return `ssh ${this.item.username}@${this.item.host} -p ${this.item.port}`
      default:
        return `${this.item.type}://${this.item.username}@${this.item.host}`
    }
  }

  body () {
    switch (this.item.type) {
      case 'web':
        return this.bodyWeb()
      case 'serial':
        return this.bodySerial()
      case 'local':
        return this.bodyLocal()
      default:
        return this.bodySsh()
    }
  }

  bodyLocal () {
    return (
      <>
        {this.bodyRunScripts()}
        {this.bodyDescription()}
      </>
    )
  }

  bodyWeb () {
    return <>{this.bodyDescription()}</>
  }

  bodySsh () {
    return (
      <>
        <p>
          <strong>{e('host')}:</strong> {this.item.host}
        </p>
        <p>
          <strong>{e('port')}:</strong> {this.item.port}
        </p>
        <p>
          <strong>{e('username')}:</strong> {this.item.username}
        </p>
        {this.bodyPassword()}
        {this.bodyDescription()}
      </>
    )
  }

  bodySerial () {
    return (
      <>
        <p>
          <strong>{e('path')}:</strong> {this.item.path}
        </p>
        {this.bodyDescription()}
      </>
    )
  }

  bodyDescription () {
    return (
      <>
        {this.item?.description?.length > 0
          ? (
            <p>
              <strong>{e('description')}:</strong> {this.item.description}
            </p>
            )
          : (
            <></>
            )}
      </>
    )
  }

  bodyRunScripts () {
    return (
      <ol className='runScripts-limit'>
        {this.item?.runScripts.map((script, index) => (
          <li key={index}>{script.script}</li>
        ))}
      </ol>
    )
  }

  bodyPassword () {
    return (
      <>
        {this.item?.password?.length > 0
          ? (
            <p>
              <strong>{e('password')}:</strong>{' '}
              <span
                className='clipboard'
                onClick={() => navigator.clipboard.writeText(this.item.password)}
              >
                {'*'.repeat(this.item.password.length)}
              </span>
            </p>
            )
          : (
            <></>
            )}
      </>
    )
  }

  renderBreadcrumb () {
    const breadcrumbs = []
    const titles = this.item?.parent.titles
    for (let index = 0; index < titles.length; index++) {
      const title = titles[index]
      if (index < titles.length - 1) {
        breadcrumbs.push(
          <span key={index}>
            {' '}
            <a href='#'>{title}</a> &gt;
          </span>
        )
      } else {
        breadcrumbs.push(
          <span key={index}>
            {' '}
            <span>{title}</span>
          </span>
        )
      }
    }
    return breadcrumbs
  }

  edit (item) {
    const { store } = window
    store.openBookmarkEdit(item)
  }

  connect (id) {
    const { store } = window
    store.onSelectBookmark(id)
  }

  render () {
    const url = this.url()

    return (
      <div className='bookmark'>
        <div className='breadcrumb'>{this.renderBreadcrumb()}</div>
        <div className='bookmark-header'>
          <strong className='badge'>{this.item.type || 'ssh'}</strong>
          <div
            className='color-indicator'
            style={{ backgroundColor: this.item.color }}
          />
          <h3>{this.title()}</h3>
          {url
            ? (
              <span
                className='protocol clipboard'
                onClick={() => navigator.clipboard.writeText(url)}
              >
                {url}
              </span>
              )
            : (
              <></>
              )}
        </div>
        <div className='bookmark-body'>{this.body()}</div>
        <div className='bookmark-footer'>
          <button className='edit-button' onClick={() => this.edit(this.item)}>
            {e('edit')}
          </button>
          <button
            className='connect-button'
            onClick={() => this.connect(this.item.id)}
          >
            {e('connect')}
          </button>
        </div>
      </div>
    )
  }
}

export default Card
