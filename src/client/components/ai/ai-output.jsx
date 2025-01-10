import React from 'react'
import ReactMarkdown from 'react-markdown'
import { copy } from '../../common/clipboard'
import Link from '../common/external-link'
import { Tag } from 'antd'
import { CopyOutlined, PlayCircleOutlined } from '@ant-design/icons'
import providers from './providers'

function getBrand (baseURLAI) {
  // First, try to match with providers
  const provider = providers.find(p => p.baseURL === baseURLAI)
  if (provider) {
    return {
      brand: provider.label,
      brandUrl: provider.homepage
    }
  }

  // If no match, extract brand from URL
  try {
    const url = new URL(baseURLAI)
    const hostname = url.hostname
    const parts = hostname.split('.')
    let brand = parts[parts.length - 2] // Usually the brand name is the second-to-last part

    // Capitalize the first letter
    brand = brand.charAt(0).toUpperCase() + brand.slice(1)

    return {
      brand,
      brandUrl: `https://${parts[parts.length - 2]}.${parts[parts.length - 1]}`
    }
  } catch (error) {
    // If URL parsing fails, return null
    return {
      brand: null,
      brandUrl: null
    }
  }
}

const e = window.translate

export default function AIOutput ({ item }) {
  const {
    response,
    baseURLAI
  } = item
  if (!response) {
    return null
  }

  const { brand, brandUrl } = getBrand(baseURLAI)

  const renderCode = (props) => {
    const { node, className = '', children, ...rest } = props
    const code = String(children).replace(/\n$/, '')
    const inline = !className.includes('language-')
    if (inline) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
    }

    const copyToClipboard = () => {
      copy(code)
    }

    const runInTerminal = () => {
      window.store.runCommandInTerminal(code)
    }

    return (
      <div className='code-block'>
        <pre>
          <code className={className} {...rest}>
            {children}
          </code>
        </pre>
        <div className='code-block-actions'>
          <CopyOutlined
            className='code-action-icon pointer'
            onClick={copyToClipboard}
            title={e('copy')}
          />
          <PlayCircleOutlined
            className='code-action-icon pointer mg1l'
            onClick={runInTerminal}
          />
        </div>
      </div>
    )
  }

  function renderBrand () {
    if (!brand) {
      return null
    }
    return (
      <div className='pd1y'>
        <Link to={brandUrl}>
          <Tag>{brand}</Tag>
        </Link>
      </div>
    )
  }

  const mdProps = {
    children: response,
    components: {
      code: renderCode
    }
  }

  return (
    <div className='pd1'>
      {renderBrand()}
      <ReactMarkdown {...mdProps} />
    </div>
  )
}
