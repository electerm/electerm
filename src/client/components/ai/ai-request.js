const providerOptions = providerAI => ({ providerAI: providerAI || 'api' })

export function runAIchat (providerAI, ...args) {
  while (args.length < 11) args.push(undefined)
  return window.pre.runGlobalAsync('AIchat', ...args, providerOptions(providerAI))
}

export function runAIchatWithTools (providerAI, ...args) {
  while (args.length < 10) args.push(undefined)
  return window.pre.runGlobalAsync('AIchatWithTools', ...args, providerOptions(providerAI))
}

export function runAIlistModels (providerAI, ...args) {
  if (providerAI && providerAI !== 'api') {
    return window.pre.runGlobalAsync('AIlistSubscriptionModels', providerAI, args[3])
  }
  while (args.length < 4) args.push(undefined)
  return window.pre.runGlobalAsync('AIlistModels', ...args, providerOptions(providerAI))
}

export default { runAIchat, runAIchatWithTools, runAIlistModels }
