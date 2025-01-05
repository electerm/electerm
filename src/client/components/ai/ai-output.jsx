// import React from 'react'
// import ReactMarkdown from 'react-markdown'
// import { Button, Tooltip } from 'antd'
// import { CopyOutlined, PlayCircleOutlined } from '@ant-design/icons'

// const AIOutput = ({ content }) => {
//   // const copyToClipboard = (text) => {
//   //   navigator.clipboard.writeText(text)
//   // }

//   // const runInTerminal = (command) => {
//   //   window.store.runCommandInTerminal(command)
//   // }

// //   const renderCode = ({ node, inline, className, children, ...props }) => {
// //     const match = /language-(\w+)/.exec(className || '')
// //     const language = match ? match[1] : ''
// //     const isCommand = language === 'bash' || language === 'shell'
// //     const code = String(children).replace(/\n$/, '')

// //     if (inline) {
// //       return (
// //         <code>
// //           {children}
// //         </code>
// //       )
// //     }

// //     return (
// //       <div>
// //         <pre>
// //           <code>
// //             {code}

// //           </code>
// //         </pre>
// //         <div className='code-block-actions'>
// //           <Tooltip>
// //             <Button
// //               icon={
// //                 <CopyOutlined />
// // }
// //               onClick={() => copyToClipboard(code)}
// //             />

// //           </Tooltip>
// //           {isCommand && (
// //             <Tooltip>
// //               <Button
// //                 icon={
// //                   <PlayCircleOutlined />
// // }
// //                 onClick={() => runInTerminal(code)}
// //               />

// //             </Tooltip>
// //           )}
// //         </div>
// //       </div>
// //     )
// //   }

//   return (

//     <div>
//       <ReactMarkdown>
//         {content}
//       </ReactMarkdown>
//     </div>
//   )
// }

// export default AIOutput
