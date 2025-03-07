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

// Chat completions endpoint
app.post('/chat/completions', (req, res) => {
  const { messages } = req.body
  const lastMessage = messages[messages.length - 1].content

  if (lastMessage.includes('give me max 5 command suggestions for user input')) {
    const userInput = extractUserInput(lastMessage)
    const mockSuggestions = generateTestCommands(userInput)

    res.json({
      choices: [{
        message: {
          content: JSON.stringify(mockSuggestions)
        }
      }]
    })
  } else {
    // Mock response for regular chat in markdown format
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
