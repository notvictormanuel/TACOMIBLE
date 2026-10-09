// Genera los PNG del manifest a partir de public/icons/icono.svg usando Chromium (Playwright).
// Uso: npm run icons  (requiere playwright instalado: npx playwright o global)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
let chromium
try {
  ;({ chromium } = require('playwright'))
} catch {
  ;({ chromium } = require(join(process.execPath, '../../lib/node_modules/playwright')))
}

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(raiz, 'public/icons/icono.svg'), 'utf8')

const salidas = [
  { archivo: 'icono-192.png', tam: 192, margen: 0 },
  { archivo: 'icono-512.png', tam: 512, margen: 0 },
  { archivo: 'apple-touch-icon.png', tam: 180, margen: 0 },
  // Maskable: el dibujo dentro de la zona segura (80 %) sobre fondo negro.
  { archivo: 'icono-maskable-512.png', tam: 512, margen: 0.12 },
]

const navegador = await chromium.launch()
const pagina = await navegador.newPage()
for (const { archivo, tam, margen } of salidas) {
  await pagina.setViewportSize({ width: tam, height: tam })
  const interior = Math.round(tam * (1 - margen * 2))
  await pagina.setContent(
    `<html><body style="margin:0;background:#000;display:grid;place-items:center;width:${tam}px;height:${tam}px">
      <div style="width:${interior}px;height:${interior}px">${svg.replace('<svg ', `<svg width="${interior}" height="${interior}" `)}</div>
    </body></html>`,
  )
  await pagina.screenshot({ path: join(raiz, 'public/icons', archivo), omitBackground: false })
  console.log('✓', archivo)
}
await navegador.close()
