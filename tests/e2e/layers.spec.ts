import { test, expect } from '@playwright/test'

test.describe('map layers', () => {
  test.beforeEach(async ({ context, page }) => {
    // Clear all storage to ensure clean state
    await context.clearCookies()
    
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })

    // Navigate with seed parameter and wait for full load
    // NOTE:
    // - We use a fixed seed ("test-seed") to make map generation deterministic for snapshot tests.
    // - Snapshots are OS-independent (configured in playwright.config.ts).
    await page.goto('/?seed=test-seed')
    
    // Wait for map generation to complete by checking window.mapId
    // mapId is exposed on window at the very end of showStatistics()
    await page.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 60000 })
    
    // Additional wait for any rendering/animations to settle
    await page.waitForTimeout(500)
  })

  // Ocean and water layers
  test('ocean layer', async ({ page }) => {
    const ocean = page.locator('#ocean')
    await expect(ocean).toBeAttached()
    const html = await ocean.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('ocean.html')
  })

  test('lakes layer', async ({ page }) => {
    const lakes = page.locator('#lakes')
    await expect(lakes).toBeAttached()
    const html = await lakes.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('lakes.html')
  })

  test('coastline layer', async ({ page }) => {
    const coastline = page.locator('#coastline')
    await expect(coastline).toBeAttached()
    const html = await coastline.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('coastline.html')
  })

  // Terrain and heightmap layers
  test('terrain layer', async ({ page }) => {
    const terrs = page.locator('#terrs')
    await expect(terrs).toBeAttached()
    const html = await terrs.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('terrain.html')
  })

  test('landmass layer', async ({ page }) => {
    const landmass = page.locator('#landmass')
    await expect(landmass).toBeAttached()
    const html = await landmass.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('landmass.html')
  })

  // Climate and environment layers
  test('biomes layer', async ({ page }) => {
    const biomes = page.locator('#biomes')
    await expect(biomes).toBeAttached()
    const html = await biomes.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('biomes.html')
  })

  test('ice layer', async ({ page }) => {
    const ice = page.locator('#ice')
    await expect(ice).toBeAttached()
    const html = await ice.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('ice.html')
  })

  test('temperature layer', async ({ page }) => {
    const temperature = page.locator('#temperature')
    await expect(temperature).toBeAttached()
    const html = await temperature.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('temperature.html')
  })

  test('precipitation layer', async ({ page }) => {
    const prec = page.locator('#prec')
    await expect(prec).toBeAttached()
    const html = await prec.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('precipitation.html')
  })

  // Geographic features
  test('rivers layer', async ({ page }) => {
    const rivers = page.locator('#rivers')
    await expect(rivers).toBeAttached()
    const html = await rivers.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('rivers.html')
  })

  test('relief layer', async ({ page }) => {
    const terrain = page.locator('#terrain')
    await expect(terrain).toBeAttached()
    const html = await terrain.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('relief.html')
  })

  // Political layers
  test('states/regions layer', async ({ page }) => {
    const regions = page.locator('#regions')
    await expect(regions).toBeAttached()
    const html = await regions.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('regions.html')
  })

  test('provinces layer', async ({ page }) => {
    const provs = page.locator('#provs')
    await expect(provs).toBeAttached()
    const html = await provs.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('provinces.html')
  })

  test('borders layer', async ({ page }) => {
    const borders = page.locator('#borders')
    await expect(borders).toBeAttached()
    const html = await borders.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('borders.html')
  })

  // Cultural layers
  test('cultures layer', async ({ page }) => {
    const cults = page.locator('#cults')
    await expect(cults).toBeAttached()
    const html = await cults.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('cultures.html')
  })

  test('religions layer', async ({ page }) => {
    const relig = page.locator('#relig')
    await expect(relig).toBeAttached()
    const html = await relig.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('religions.html')
  })

  // Infrastructure layers
  test('routes layer', async ({ page }) => {
    const routes = page.locator('#routes')
    await expect(routes).toBeAttached()
    const html = await routes.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('routes.html')
  })

  // Settlement layers
  test('burgs/icons layer', async ({ page }) => {
    const icons = page.locator('#icons')
    await expect(icons).toBeAttached()
    const html = await icons.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('icons.html')
  })

  test('anchors layer', async ({ page }) => {
    const anchors = page.locator('#anchors')
    await expect(anchors).toBeAttached()
    const html = await anchors.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('anchors.html')
  })

  // Labels layer (without text content due to font rendering)
  test('labels layer', async ({ page }) => {
    const labels = page.locator('#labels')
    await expect(labels).toBeAttached()
    // Remove text content but keep structure (text rendering varies)
    const html = await labels.evaluate((el) => {
      const clone = el.cloneNode(true) as Element
      clone.querySelectorAll('text, tspan').forEach((t) => t.remove())
      return clone.outerHTML
    })
    expect(html).toMatchSnapshot('labels.html')
  })

  // Military and markers
  test('markers layer', async ({ page }) => {
    const markers = page.locator('#markers')
    await expect(markers).toBeAttached()
    const html = await markers.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('markers.html')
  })

  test('armies layer', async ({ page }) => {
    const armies = page.locator('#armies')
    await expect(armies).toBeAttached()
    const html = await armies.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('armies.html')
  })

  // Special features
  test('zones layer', async ({ page }) => {
    const zones = page.locator('#zones')
    await expect(zones).toBeAttached()
    const html = await zones.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('zones.html')
  })

  test('emblems layer', async ({ page }) => {
    const emblems = page.locator('#emblems')
    await expect(emblems).toBeAttached()
    const html = await emblems.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('emblems.html')
  })

  // Grid and coordinates
  test('cells layer', async ({ page }) => {
    const cells = page.locator('g#cells')
    await expect(cells).toBeAttached()
    const html = await cells.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('cells.html')
  })

  test('coordinates layer', async ({ page }) => {
    const coordinates = page.locator('#coordinates')
    await expect(coordinates).toBeAttached()
    const html = await coordinates.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('coordinates.html')
  })

  test('compass layer', async ({ page }) => {
    const compass = page.locator('#compass')
    await expect(compass).toBeAttached()
    const html = await compass.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('compass.html')
  })

  // UI elements
  test('scale bar layer', async ({ page }) => {
    const scaleBar = page.locator('#scaleBar')
    await expect(scaleBar).toBeAttached()
    // Scale bar has randomized distances, snapshot structure only
    const html = await scaleBar.evaluate((el) => {
      const clone = el.cloneNode(true) as Element
      clone.querySelectorAll('text').forEach((t) => t.remove())
      return clone.outerHTML
    })
    expect(html).toMatchSnapshot('scaleBar.html')
  })

  test('ruler layer', async ({ page }) => {
    const ruler = page.locator('#ruler')
    await expect(ruler).toBeAttached()
    const html = await ruler.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('ruler.html')
  })

  test('vignette layer', async ({ page }) => {
    const vignette = page.locator('#vignette')
    await expect(vignette).toBeAttached()
    const html = await vignette.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('vignette.html')
  })

  // Population layer
  test('population layer', async ({ page }) => {
    const population = page.locator('#population')
    await expect(population).toBeAttached()
    const html = await population.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('population.html')
  })
})
