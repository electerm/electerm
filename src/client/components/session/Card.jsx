import { Component } from 'react'

const e = window.translate

class Card extends Component {
  item = []

  constructor (props) {
    super(props)
    this.item = props.item
  }

  title () {
    return this.item.title || `${this.item.username}@${this.item.host}`
  }

  url () {
    switch (this.item.type) {
      case 'rdp':
        return `rdp://${this.item.username}@${this.item.host}` // TODO: serial
      default:
        return `ssh ${this.item.username}@${this.item.host} -p ${this.item.port}`
    }
  }

  body () {
    switch (this.item.type) {
      case 'rdp':
        return this.bodyRdp() // TODO: serial
      default:
        return this.bodySsh()
    }
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

  bodyRdp () {
    return this.bodySsh()
  }

  renderBreadcrumb () {
    const breadcrumbs = []
    const titles = this.item?.parent.titles
    for (let index = 0; index < titles.length; index++) {
      const title = titles[index]
      if (index < titles.length - 1) {
        breadcrumbs.push(
          <>
            {' '}
            <a href='#'>{title}</a> &gt;
          </>
        )
      } else {
        breadcrumbs.push(
          <>
            {' '}
            <span>{title}</span>
          </>
        )
      }
    }
    return breadcrumbs
  }

  edit (id) {
    const { store } = window
    store.openBookmarkEdit(id)
  }

  connect (id) {
    const { store } = window
    store.onSelectBookmark(id)
  }

  render () {
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
          <span
            className='protocol clipboard'
            onClick={() => navigator.clipboard.writeText(this.url())}
          >
            {this.url()}
          </span>
        </div>
        <div className='bookmark-body'>{this.body()}</div>
        <div className='bookmark-footer'>
          <button className='edit-button' onClick={() => this.edit(this.item.id)}>{e('edit')}</button>
          <button className='connect-button' onClick={() => this.connect(this.item.id)}>{e('connect')}</button>
        </div>
      </div>
    )
  }
}

export default Card
