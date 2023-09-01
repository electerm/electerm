import Icon from '@ant-design/icons'

// from https://icon-sets.iconify.design/codicon/regex/
const regExpSvg = () => (
  <svg width='1em' height='1em' viewBox='0 0 16 16'>
    <path fill='currentColor' fillRule='evenodd' d='M10.012 2h.976v3.113l2.56-1.557l.486.885L11.47 6l2.564 1.559l-.485.885l-2.561-1.557V10h-.976V6.887l-2.56 1.557l-.486-.885L9.53 6L6.966 4.441l.485-.885l2.561 1.557V2zM2 10h4v4H2v-4z' clipRule='evenodd' />
  </svg>
)

export const RegularExpIcon = props => (<Icon component={regExpSvg} {...props} />)
