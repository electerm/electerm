export default function CssOverwrite () {
  return (
    <style>
      {`
        #container .sessions .xterm-screen::before { content: none; background-image: none; }
        #container .sessions .xterm { background: var(--terminal-bg); }
      `}
    </style>
  )
}
