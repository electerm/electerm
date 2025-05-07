// mathematicalBackground.js

/**
 * Generates mathematical and physics-based backgrounds for terminal
 * Replaces the text-based cat patterns with proper canvas graphics
 */

/**
 * Generate a canvas with a mathematical or physical pattern
 * @param {number} size - Size of the canvas
 * @returns {string} - Data URL of the generated canvas
 */
export function generateMosaicBackground (size = 200) {
  // Create canvas with transparent background
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  // Clear with transparent background
  ctx.clearRect(0, 0, size, size)

  // Available pattern generators
  const patterns = [
    generateFluidDynamics,
    generateQuantumWave,
    generateRelativityField,
    generateFluidFlow,
    generateParticlePhysics,
    generateWaveInterference,
    generateStringTheory,
    generateQuantumField
  ]

  // Select a random pattern
  const selectedPattern = patterns[Math.floor(Math.random() * patterns.length)]

  // Generate random color parameters
  const hue = Math.floor(Math.random() * 360)
  const saturation = 70 + Math.floor(Math.random() * 20)
  const lightness = 70 + Math.floor(Math.random() * 20)

  // Generate the pattern with given color
  selectedPattern(ctx, size, `hsla(${hue}, ${saturation}%, ${lightness}%, 0.3)`)

  // Return the canvas as a data URL
  return canvas.toDataURL()
}

/**
 * Generates a fluid dynamics simulation pattern
 */
function generateFluidDynamics (ctx, size, color) {
  const points = 6 + Math.floor(Math.random() * 6)
  const baseRadius = size * 0.3
  const turbulence = 0.3 + Math.random() * 0.4
  const detail = 5 + Math.floor(Math.random() * 5)

  // Create multiple vortices
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2
    const distance = baseRadius * (0.5 + Math.random() * 0.5)
    const cx = size / 2 + Math.cos(angle) * distance
    const cy = size / 2 + Math.sin(angle) * distance
    const radius = size * (0.1 + Math.random() * 0.15)

    // Draw vortex
    ctx.strokeStyle = color
    ctx.lineWidth = 1

    for (let j = 0; j < detail; j++) {
      const spiralRadius = radius * (j / detail)
      const spiralTurns = 2 + Math.random() * 3

      ctx.beginPath()
      for (let t = 0; t <= Math.PI * 2 * spiralTurns; t += 0.1) {
        const r = spiralRadius * (1 - t / (Math.PI * 2 * spiralTurns))
        const noise = Math.sin(t * 5) * turbulence * r
        const x = cx + (r + noise) * Math.cos(t)
        const y = cy + (r + noise) * Math.sin(t)

        if (t === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
    }
  }
}

/**
 * Generates a quantum wave probability pattern
 */
function generateQuantumWave (ctx, size, color) {
  const centerX = size / 2
  const centerY = size / 2
  const maxRadius = size * 0.45
  const waveCount = 3 + Math.floor(Math.random() * 5)

  ctx.strokeStyle = color
  ctx.lineWidth = 1.5

  // Generate wave packets with interference
  for (let w = 0; w < waveCount; w++) {
    const offsetX = (Math.random() - 0.5) * size * 0.3
    const offsetY = (Math.random() - 0.5) * size * 0.3
    const frequency = 5 + Math.random() * 10
    const amplitude = 5 + Math.random() * 10
    const phase = Math.random() * Math.PI * 2

    ctx.beginPath()

    for (let angle = 0; angle <= Math.PI * 2; angle += 0.02) {
      const baseRadius = maxRadius * (0.2 + Math.random() * 0.8)
      const waveR = baseRadius + Math.sin(angle * frequency + phase) * amplitude

      const x = centerX + offsetX + waveR * Math.cos(angle)
      const y = centerY + offsetY + waveR * Math.sin(angle)

      if (angle === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }

    ctx.closePath()
    ctx.stroke()
  }
}

/**
 * Generates a relativity field with curved spacetime
 */
function generateRelativityField (ctx, size, color) {
  const centerX = size / 2
  const centerY = size / 2
  const gridLines = 8 + Math.floor(Math.random() * 7)
  const massPoints = 2 + Math.floor(Math.random() * 3)
  const distortion = 0.2 + Math.random() * 0.5

  ctx.strokeStyle = color
  ctx.lineWidth = 1

  // Create mass points that distort spacetime
  const masses = []
  for (let i = 0; i < massPoints; i++) {
    masses.push({
      x: centerX + (Math.random() - 0.5) * size * 0.6,
      y: centerY + (Math.random() - 0.5) * size * 0.6,
      mass: 0.3 + Math.random() * 0.7
    })
  }

  // Draw a grid that gets distorted by the masses
  for (let i = 0; i <= gridLines; i++) {
    // Horizontal lines
    ctx.beginPath()
    for (let x = 0; x < size; x += 2) {
      let y = (i / gridLines) * size

      // Apply distortion from masses
      for (const mass of masses) {
        const dx = x - mass.x
        const dy = y - mass.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const force = mass.mass * distortion * size / (distance + 10)

        // Add gravitational displacement
        y += force * (y - mass.y) / (distance + 1)
      }

      if (x === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()

    // Vertical lines
    ctx.beginPath()
    for (let y = 0; y < size; y += 2) {
      let x = (i / gridLines) * size

      // Apply distortion from masses
      for (const mass of masses) {
        const dx = x - mass.x
        const dy = y - mass.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const force = mass.mass * distortion * size / (distance + 10)

        // Add gravitational displacement
        x += force * (x - mass.x) / (distance + 1)
      }

      if (y === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()
  }
}

/**
 * Generates a fluid flow field with streamlines
 */
function generateFluidFlow (ctx, size, color) {
  const detail = 15 + Math.floor(Math.random() * 15)
  const vectors = []
  const streamlines = 12 + Math.floor(Math.random() * 12)

  // Create a vector field using perlin-like noise
  for (let i = 0; i < detail; i++) {
    for (let j = 0; j < detail; j++) {
      const x = (i + 0.5) * (size / detail)
      const y = (j + 0.5) * (size / detail)

      // Generate vector field using harmonic functions for smoother flow
      const angle = Math.sin(x * 0.01) * Math.cos(y * 0.01) * Math.PI * 2 +
                   Math.sin(x * 0.02 + y * 0.01) * Math.PI +
                   Math.cos(x * 0.01 - y * 0.03) * Math.PI

      vectors.push({
        x,
        y,
        dx: Math.cos(angle),
        dy: Math.sin(angle)
      })
    }
  }

  // Interpolate vector at any position
  function getVector (x, y) {
    // Find the four nearest vectors
    let totalWeight = 0
    let dx = 0
    let dy = 0

    for (const v of vectors) {
      const distance = Math.sqrt((x - v.x) ** 2 + (y - v.y) ** 2)
      const weight = 1 / (distance + 0.1)

      dx += v.dx * weight
      dy += v.dy * weight
      totalWeight += weight
    }

    return {
      dx: dx / totalWeight,
      dy: dy / totalWeight
    }
  }

  // Draw streamlines
  ctx.strokeStyle = color
  ctx.lineWidth = 1

  for (let i = 0; i < streamlines; i++) {
    // Random starting point
    let x = Math.random() * size
    let y = Math.random() * size

    ctx.beginPath()
    ctx.moveTo(x, y)

    // Follow the vector field
    for (let step = 0; step < 100; step++) {
      const v = getVector(x, y)
      x += v.dx * 5
      y += v.dy * 5

      if (x < 0 || x >= size || y < 0 || y >= size) break

      ctx.lineTo(x, y)
    }

    ctx.stroke()
  }
}

/**
 * Generates a particle physics pattern with collision tracks
 */
function generateParticlePhysics (ctx, size, color) {
  const centerX = size / 2
  const centerY = size / 2
  const particleCount = 20 + Math.floor(Math.random() * 20)
  const maxRadius = size * 0.4

  ctx.strokeStyle = color
  ctx.lineWidth = 1

  // Create a simulated particle collision
  for (let i = 0; i < particleCount; i++) {
    // Start from center
    const angle = Math.random() * Math.PI * 2
    const speed = 2 + Math.random() * 4
    let x = centerX
    let y = centerY
    let vx = Math.cos(angle) * speed
    let vy = Math.sin(angle) * speed

    // Add some curvature for charged particles
    const charge = (Math.random() - 0.5) * 0.2

    ctx.beginPath()
    ctx.moveTo(x, y)

    // Trace the particle path
    for (let step = 0; step < 100; step++) {
      // Update velocity (magnetic field effect)
      const perpX = -vy
      const perpY = vx
      vx += perpX * charge
      vy += perpY * charge

      // Normalize velocity
      const speed = Math.sqrt(vx * vx + vy * vy)
      vx = vx / speed * 3
      vy = vy / speed * 3

      // Update position
      x += vx
      y += vy

      // Random scattering or decay
      if (Math.random() < 0.05) {
        vx += (Math.random() - 0.5) * 2
        vy += (Math.random() - 0.5) * 2
      }

      ctx.lineTo(x, y)

      // Stop if went too far
      if (Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) > maxRadius) {
        break
      }
    }

    ctx.stroke()
  }
}

/**
 * Generates a wave interference pattern
 */
function generateWaveInterference (ctx, size, color) {
  const waveCount = 3 + Math.floor(Math.random() * 3)
  const resolution = 2

  // Generate multiple waves and compute interference
  const sources = []
  for (let i = 0; i < waveCount; i++) {
    sources.push({
      x: Math.random() * size,
      y: Math.random() * size,
      frequency: 0.05 + Math.random() * 0.1,
      amplitude: 0.5 + Math.random() * 0.5
    })
  }

  // Compute the interference pattern
  for (let x = 0; x < size; x += resolution) {
    for (let y = 0; y < size; y += resolution) {
      let value = 0

      // Sum all wave contributions
      for (const source of sources) {
        const dx = x - source.x
        const dy = y - source.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        // Add wave contribution
        value += Math.cos(distance * source.frequency * Math.PI * 2) * source.amplitude
      }

      // Only draw peaks
      if (value > 0.8) {
        const opacity = (value - 0.8) * 3
        const finalColor = color.replace(/[\d.]+\)$/, `${opacity * 0.5})`)
        ctx.fillStyle = finalColor
        ctx.fillRect(x, y, resolution, resolution)
      }
    }
  }
}

/**
 * Generates a string theory inspired pattern
 */
function generateStringTheory (ctx, size, color) {
  const centerX = size / 2
  const centerY = size / 2
  const strings = 100 + Math.floor(Math.random() * 150)
  const dimensions = 6 + Math.floor(Math.random() * 5)

  ctx.strokeStyle = color
  ctx.lineWidth = 0.5

  for (let i = 0; i < strings; i++) {
    // Base string params
    const radius = 10 + Math.random() * size * 0.35
    const startAngle = Math.random() * Math.PI * 2

    // Additional dimensional parameters (projected to 2D)
    const phases = []
    const frequencies = []
    for (let d = 0; d < dimensions; d++) {
      phases.push(Math.random() * Math.PI * 2)
      frequencies.push(1 + Math.random() * 5)
    }

    ctx.beginPath()

    // Draw the string vibration
    for (let t = 0; t <= Math.PI * 2; t += 0.05) {
      let x = centerX + radius * Math.cos(t + startAngle)
      let y = centerY + radius * Math.sin(t + startAngle)

      // Add vibrational modes from extra dimensions
      for (let d = 0; d < dimensions; d++) {
        const vibration = Math.sin(t * frequencies[d] + phases[d])
        x += vibration * (5 + Math.random() * 5) * Math.cos(t + Math.PI / 2)
        y += vibration * (5 + Math.random() * 5) * Math.sin(t + Math.PI / 2)
      }

      if (t === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }

    ctx.stroke()
  }
}

/**
 * Generates a quantum field theory inspired pattern
 */
function generateQuantumField (ctx, size, color) {
  const points = 10 + Math.floor(Math.random() * 15)
  const fieldStrength = 10 + Math.random() * 10

  // Create virtual particles
  const particles = []
  for (let i = 0; i < points; i++) {
    particles.push({
      x: Math.random() * size,
      y: Math.random() * size,
      charge: Math.random() * 2 - 1
    })
  }

  // Draw field lines
  ctx.strokeStyle = color
  ctx.lineWidth = 0.8

  // Grid resolution
  const resolution = 15

  for (let i = 0; i <= resolution; i++) {
    for (let j = 0; j <= resolution; j++) {
      const x = (i / resolution) * size
      const y = (j / resolution) * size

      // Calculate field vector at this point
      let fieldX = 0
      let fieldY = 0

      for (const particle of particles) {
        const dx = x - particle.x
        const dy = y - particle.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const force = fieldStrength * particle.charge / (distance * distance + 100)

        fieldX += dx * force
        fieldY += dy * force
      }

      // Normalize field vector
      const magnitude = Math.sqrt(fieldX * fieldX + fieldY * fieldY)
      if (magnitude > 0) {
        fieldX = fieldX / magnitude
        fieldY = fieldY / magnitude
      }

      // Draw field vector
      const lineLength = 10 + Math.random() * 5
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + fieldX * lineLength, y + fieldY * lineLength)
      ctx.stroke()
    }
  }
}
