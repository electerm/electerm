import providers from './providers'

export default function getBrand (baseURLAI) {
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
