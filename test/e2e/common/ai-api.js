const express = require('express')
const app = express()
const port = 43434

// Middleware for JSON parsing
app.use(express.json())

// Middleware to check Bearer token
app.use((req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }
  next()
})

// Helper function to extract user input from message
function extractUserInput (message) {
  const match = message.match(/user input: "([^"]*)"/)
  return match ? match[1] : ''
}

// Generate 5 fake commands that start with user input
function generateTestCommands (userInput) {
  return [
    `${userInput}-test-command-1`,
    `${userInput}-test-command-2`,
    `${userInput}-test-command-3`,
    `${userInput}-test-command-4`,
    `${userInput}-test-command-5`
  ]
}

// Generate a test bookmark based on description
function generateTestBookmark (description) {
  return {
    title: `Test Server - ${description.slice(0, 20)}`,
    host: 'test.example.com',
    port: 22,
    username: 'testuser',
    type: 'ssh',
    description
  }
}

// Chat completions endpoint
app.post('/chat/completions', (req, res) => {
  const { messages, stream } = req.body
  const lastMessage = messages[messages.length - 1].content

  if (lastMessage.includes('give me max 5 command suggestions for user input')) {
    const userInput = extractUserInput(lastMessage)
    const mockSuggestions = generateTestCommands(userInput)

    // Command suggestions are always non-streaming
    res.json({
      choices: [{
        message: {
          content: JSON.stringify(mockSuggestions)
        }
      }]
    })
  } else if (lastMessage.includes('Generate the bookmark JSON')) {
    const bookmarkData = generateTestBookmark(lastMessage)
    res.json({
      choices: [{
        message: {
          content: JSON.stringify(bookmarkData, null, 2)
        }
      }]
    })
  } else if (stream) {
    // Handle streaming response
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Transfer-Encoding': 'chunked'
    })

    const mockResponse = '# Response to your query\n\n' +
      'Here is a sample response with different markdown elements:\n\n' +
      '## Code Example\n' +
      '```javascript\n' +
      'console.log("Hello World!");\n' +
      '```\n\n' +
      '## List Example\n' +
      '- Item 1\n' +
      '- Item 2\n' +
      '- Item 3\n\n' +
      '## Text Formatting\n' +
      '**Bold text** and *italic text*\n\n' +
      '> This is a blockquote\n\n' +
      '[This is a link](https://example.com)'

    // Split response into chunks and send as streaming data
    const chunks = mockResponse.split(' ')
    let index = 0

    const sendChunk = () => {
      if (index < chunks.length) {
        const content = chunks[index] + (index < chunks.length - 1 ? ' ' : '')
        const streamData = {
          choices: [{
            delta: {
              content
            }
          }]
        }
        res.write(`data: ${JSON.stringify(streamData)}\n\n`)
        index++
        setTimeout(sendChunk, 50) // Simulate streaming delay
      } else {
        res.write('data: [DONE]\n\n')
        res.end()
      }
    }

    sendChunk()
  } else {
    // Handle non-streaming response
    const mockResponse = '# Response to your query\n\n' +
      'Here is a sample response with different markdown elements:\n\n' +
      '## Code Example\n' +
      '```javascript\n' +
      'console.log("Hello World!");\n' +
      '```\n\n' +
      '## List Example\n' +
      '- Item 1\n' +
      '- Item 2\n' +
      '- Item 3\n\n' +
      '## Text Formatting\n' +
      '**Bold text** and *italic text*\n\n' +
      '> This is a blockquote\n\n' +
      '[This is a link](https://example.com)'

    res.json({
      choices: [{
        message: {
          content: mockResponse
        }
      }]
    })
  }
})

app.listen(port, '127.0.0.1', () => {
  console.log(`Mock AI API server running at http://127.0.0.1:${port}`)
})
