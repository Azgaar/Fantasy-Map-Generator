import { Browser, BrowserContext, expect, Page, test } from '@playwright/test'

// All tests in this describe block only READ the DOM — they never modify state.
// Load the map once for the entire suite instead of before every test.
let sharedContext: BrowserContext
let sharedPage: Page

test.describe('map layers', () => {
  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    sharedContext = await browser.newContext()
    sharedPage = await sharedContext.newPage()

    await sharedContext.clearCookies()
    await sharedPage.goto('/')
    await sharedPage.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })

    // Navigate with seed parameter and wait for full load
    // NOTE:
    // - We use a fixed seed ("test-seed") to make map generation deterministic for snapshot tests.
    // - Snapshots are OS-independent (configured in playwright.config.ts).
    await sharedPage.goto('/?seed=test-seed&&width=1280&height=720')

    // Wait for map generation to complete by checking window.mapId
    // mapId is exposed on window at the very end of showStatistics()
    await sharedPage.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 60000 })

    // Additional wait for any rendering/animations to settle
    await sharedPage.waitForTimeout(500)
  })

  test.afterAll(async () => {
    await sharedPage.close()
    await sharedContext.close()
  })

  // Ocean and water layers
  test('ocean layer', async () => {
    const ocean = sharedPage.locator('#ocean')
    await expect(ocean).toBeAttached()
    const html = await ocean.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('ocean.html')
  })

  test('lakes layer', async () => {
    const lakes = sharedPage.locator('#lakes')
    await expect(lakes).toBeAttached()
    const html = await lakes.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('lakes.html')
  })

  test('coastline layer', async () => {
    const coastline = sharedPage.locator('#coastline')
    await expect(coastline).toBeAttached()
    const html = await coastline.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('coastline.html')
  })

  // Terrain and heightmap layers
  test('terrain layer', async () => {
    const terrs = sharedPage.locator('#terrs')
    await expect(terrs).toBeAttached()
    const html = await terrs.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('terrain.html')
  })

  test('landmass layer', async () => {
    const landmass = sharedPage.locator('#landmass')
    await expect(landmass).toBeAttached()
    const html = await landmass.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('landmass.html')
  })

  // Climate and environment layers
  test('biomes layer', async () => {
    const biomes = sharedPage.locator('#biomes')
    await expect(biomes).toBeAttached()
    const html = await biomes.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('biomes.html')
  })

  test('ice layer', async () => {
    const ice = sharedPage.locator('#ice')
    await expect(ice).toBeAttached()
    const html = await ice.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('ice.html')
  })

  test('temperature layer', async () => {
    const temperature = sharedPage.locator('#temperature')
    await expect(temperature).toBeAttached()
    const html = await temperature.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('temperature.html')
  })

  test('precipitation layer', async () => {
    const prec = sharedPage.locator('#prec')
    await expect(prec).toBeAttached()
    const html = await prec.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('precipitation.html')
  })

  // Geographic features
  test('rivers layer', async () => {
    const rivers = sharedPage.locator('#rivers')
    await expect(rivers).toBeAttached()
    const html = await rivers.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('rivers.html')
  })

  test('relief layer', async () => {
    const terrain = sharedPage.locator('#terrain')
    await expect(terrain).toBeAttached()
    const html = await terrain.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('relief.html')
  })

  // Political layers
  test('states/regions layer', async () => {
    const regions = sharedPage.locator('#regions')
    await expect(regions).toBeAttached()
    const html = await regions.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('regions.html')
  })

  test('provinces layer', async () => {
    const provs = sharedPage.locator('#provs')
    await expect(provs).toBeAttached()
    const html = await provs.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('provinces.html')
  })

  test('borders layer', async () => {
    const borders = sharedPage.locator('#borders')
    await expect(borders).toBeAttached()
    const html = await borders.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('borders.html')
  })

  // Cultural layers
  test('cultures layer', async () => {
    const cults = sharedPage.locator('#cults')
    await expect(cults).toBeAttached()
    const html = await cults.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('cultures.html')
  })

  test('religions layer', async () => {
    const relig = sharedPage.locator('#relig')
    await expect(relig).toBeAttached()
    const html = await relig.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('religions.html')
  })

  // Infrastructure layers
  test('routes layer', async () => {
    const routes = sharedPage.locator('#routes')
    await expect(routes).toBeAttached()
    const html = await routes.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('routes.html')
  })

  // Settlement layers
  test('burgs/icons layer', async () => {
    const icons = sharedPage.locator('#icons')
    await expect(icons).toBeAttached()
    const html = await icons.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('icons.html')
  })

  test('anchors layer', async () => {
    const anchors = sharedPage.locator('#anchors')
    await expect(anchors).toBeAttached()
    const html = await anchors.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('anchors.html')
  })

  // Labels layer (without text content due to font rendering)
  test('labels layer', async () => {
    const labels = sharedPage.locator('#labels')
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
  test('markers layer', async () => {
    const markers = sharedPage.locator('#markers')
    await expect(markers).toBeAttached()
    const html = await markers.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('markers.html')
  })

  test('armies layer', async () => {
    const armies = sharedPage.locator('#armies')
    await expect(armies).toBeAttached()
    const html = await armies.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('armies.html')
  })

  // Special features
  test('zones layer', async () => {
    const zones = sharedPage.locator('#zones')
    await expect(zones).toBeAttached()
    const html = await zones.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('zones.html')
  })

  test('emblems layer', async () => {
    const emblems = sharedPage.locator('#emblems')
    await expect(emblems).toBeAttached()
    const html = await emblems.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('emblems.html')
  })

  // Grid and coordinates
  test('cells layer', async () => {
    const cells = sharedPage.locator('g#cells')
    await expect(cells).toBeAttached()
    const html = await cells.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('cells.html')
  })

  test('coordinates layer', async () => {
    const coordinates = sharedPage.locator('#coordinates')
    await expect(coordinates).toBeAttached()
    const html = await coordinates.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('coordinates.html')
  })

  test('compass layer', async () => {
    const compass = sharedPage.locator('#compass')
    await expect(compass).toBeAttached()
    const html = await compass.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('compass.html')
  })

  // Population layer
  test('population layer', async () => {
    const population = sharedPage.locator('#population')
    await expect(population).toBeAttached()
    const html = await population.evaluate((el) => el.outerHTML)
    expect(html).toMatchSnapshot('population.html')
  })
})
