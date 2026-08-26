/**
 * Chart PNG export utility for Ledgr Insights
 * Captures an SVG chart element and downloads it as a high-res PNG.
 * Uses Canvas API only — no external library.
 */

/**
 * Find the SVG inside a container element and export it as PNG.
 * @param {HTMLElement} containerEl  — the div wrapping the chart
 * @param {string}      fileName     — e.g. "Ledgr-Spending-August-2026.png"
 * @param {Object}      opts
 * @param {number}      opts.scale   — pixel density (default 2 for retina)
 * @param {string}      opts.bg      — background colour (default white)
 */
export async function exportChartAsPng(containerEl, fileName, opts = {}) {
  const { scale = 2.5, bg = '#1A2540' } = opts

  if (!containerEl) throw new Error('No chart container provided')

  const svgEl = containerEl.querySelector('svg')
  if (!svgEl) throw new Error('No SVG found in chart container')

  // Clone the SVG so we can mutate it safely
  const clone = svgEl.cloneNode(true)
  const { width: rawW, height: rawH } = svgEl.getBoundingClientRect()
  const w = rawW || 600
  const h = rawH || 300

  // Ensure explicit dimensions on clone
  clone.setAttribute('width', w)
  clone.setAttribute('height', h)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  // Inject background rect at start of clone
  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  bgRect.setAttribute('width', '100%')
  bgRect.setAttribute('height', '100%')
  bgRect.setAttribute('fill', bg)
  clone.insertBefore(bgRect, clone.firstChild)

  // Serialize SVG
  const serializer = new XMLSerializer()
  const svgStr = serializer.serializeToString(clone)
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const svgUrl = URL.createObjectURL(svgBlob)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      const ctx = canvas.getContext('2d')

      // Fill background
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw the SVG image scaled up
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(svgUrl)

      // Trigger download
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Canvas toBlob failed')); return }
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href) }, 1000)
        resolve()
      }, 'image/png')
    }
    img.onerror = (e) => { URL.revokeObjectURL(svgUrl); reject(new Error('SVG image load failed')) }
    img.src = svgUrl
  })
}

/** Build a standardised file name for chart PNGs */
export function chartFileName(chartName, periodLabel) {
  const safe = (s) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
  const period = safe(periodLabel || new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }))
  return `Ledgr-${safe(chartName)}-${period}.png`
}
