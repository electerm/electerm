import './theme-terminal-preview.styl'

const ansiRows = [
  ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'],
  ['brightBlack', 'brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite']
]

export default function ThemeTerminalPreview ({ themeConfig = {}, fontFamily, fontSize }) {
  const {
    foreground = '#ddd',
    background = '#000',
    cursor = '#fff',
    cursorAccent = '#000',
    selectionBackground = 'rgba(255,255,255,.3)',
    green = '#0a0',
    blue = '#08c',
    cyan = '#0aa'
  } = themeConfig
  const bodyStyle = {}
  if (fontFamily) bodyStyle.fontFamily = fontFamily
  if (fontSize) bodyStyle.fontSize = `${fontSize}px`

  return (
    <div className='theme-terminal-preview' style={{ background, color: foreground }}>
      <div className='theme-terminal-preview-dots'>
        <span /><span /><span />
      </div>
      <div className='theme-terminal-preview-body' style={bodyStyle}>
        <div>
          <span style={{ color: green }}>user@host</span>
          <span>:</span>
          <span style={{ color: blue }}>~/project</span>
          <span>$ ls -la --color</span>
        </div>
        <div>
          <span style={{ color: blue }}>drwxr-xr-x</span> <span style={{ color: blue }}>src</span>
        </div>
        <div>
          <span style={{ color: green }}>-rwxr-xr-x</span> <span style={{ color: green }}>run.sh</span>
        </div>
        <div>
          <span style={{ color: cyan }}>lrwxrwxrwx</span> <span style={{ color: cyan }}>link -&gt; run.sh</span>
        </div>
        <div>-rw-r--r-- readme.md</div>
        <div>
          <span style={{ color: green }}>user@host</span>
          <span>:</span>
          <span style={{ color: blue }}>~/project</span>
          <span>$ </span>
          <span
            className='theme-terminal-preview-selection'
            style={{ background: selectionBackground }}
          >selected text
          </span>
          <span
            className='theme-terminal-preview-cursor'
            style={{ background: cursor, color: cursorAccent }}
          >&nbsp;
          </span>
        </div>
      </div>
      <div className='theme-terminal-preview-swatches'>
        {
          ansiRows.map((row, i) => (
            <div className='theme-terminal-preview-swatch-row' key={i}>
              {
                row.map(name => (
                  <span key={name} className='theme-terminal-preview-swatch' style={{ color: themeConfig[name] }}>
                    <span
                      className='theme-terminal-preview-swatch-dot'
                      style={{ background: themeConfig[name] }}
                    />
                    {name}
                  </span>
                ))
              }
            </div>
          ))
        }
      </div>
    </div>
  )
}
