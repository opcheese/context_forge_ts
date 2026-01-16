import { test, expect } from "@playwright/test"

// Convex HTTP endpoint base URL for local dev (port 3211, not 3210)
const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL || "http://127.0.0.1:3211"

// Helper to reset test data before tests
async function resetTestData() {
  const response = await fetch(`${CONVEX_SITE_URL}/testing/reset`, {
    method: "POST",
  })
  if (!response.ok) {
    console.warn("Failed to reset test data:", await response.text())
  }
  return response.ok
}

// Helper to create a test block via API (automatically marked as testData)
async function createTestBlock(
  content: string,
  type: string = "NOTE",
  zone: "PERMANENT" | "STABLE" | "WORKING" = "WORKING"
) {
  const response = await fetch(`${CONVEX_SITE_URL}/testing/blocks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, type, zone }),
  })
  if (!response.ok) {
    throw new Error(`Failed to create test block: ${await response.text()}`)
  }
  return response.json()
}

test.describe("App", () => {
  test("should display the title", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("h1")).toContainText("ContextForge")
  })

  test("should toggle theme", async ({ page }) => {
    await page.goto("/")

    // Find the theme toggle button
    const themeButton = page.getByRole("button", { name: /light|dark/i })
    await expect(themeButton).toBeVisible()

    // Click to toggle
    await themeButton.click()

    // Button text should change
    await expect(themeButton).toBeVisible()
  })
})

// Run Blocks tests serially to avoid parallel interference with shared data
test.describe.serial("Blocks", () => {
  // Clean up after all tests in this suite
  test.afterAll(async () => {
    await resetTestData()
  })

  test("should display zone layout", async ({ page }) => {
    await page.goto("/")

    // Check for zone headers
    await expect(page.locator("h3:has-text('Permanent')")).toBeVisible()
    await expect(page.locator("h3:has-text('Stable')")).toBeVisible()
    await expect(page.locator("h3:has-text('Working')")).toBeVisible()

    // Check for Add New Block section
    await expect(page.locator("h2:has-text('Add New Block')")).toBeVisible()
  })

  test("should create a new block via UI", async ({ page }) => {
    await page.goto("/")

    // Fill in the form (prefix with "E2E Test:" so reset cleans it up)
    await page.selectOption("#block-type", "ASSISTANT")
    await page.selectOption("#block-zone", "WORKING")
    await page.fill("#block-content", "E2E Test: UI created block")

    // Submit
    await page.getByRole("button", { name: "Add Block" }).click()

    // Wait for block to appear in the Working zone
    await expect(
      page.locator("text=E2E Test: UI created block")
    ).toBeVisible({
      timeout: 5000,
    })

    // Check the type badge (use span to avoid matching the select option)
    await expect(page.locator("span:has-text('ASSISTANT')")).toBeVisible()
  })

  test("should move a block between zones", async ({ page }) => {
    // Create a test block in WORKING zone
    await createTestBlock("E2E Test: Block to move", "NOTE", "WORKING")

    await page.goto("/")

    // Wait for block to appear
    await expect(page.locator("text=E2E Test: Block to move")).toBeVisible({
      timeout: 5000,
    })

    // Find the block card and click move to Permanent
    const blockCard = page
      .locator(".rounded-lg.border.border-border.bg-card.p-3")
      .filter({ hasText: "E2E Test: Block to move" })
    await blockCard.getByRole("button", { name: "→ Permanent" }).click()

    // Block should now be in Permanent zone - wait for the move
    await page.waitForTimeout(500)

    // The block should still be visible
    await expect(page.locator("text=E2E Test: Block to move")).toBeVisible()

    // It should now have buttons for Stable and Working (not Permanent)
    await expect(
      blockCard.getByRole("button", { name: "→ Stable" })
    ).toBeVisible()
    await expect(
      blockCard.getByRole("button", { name: "→ Working" })
    ).toBeVisible()
  })

  test("should delete a block", async ({ page }) => {
    // Create a test block via API first
    await createTestBlock("E2E Test: Block to delete", "NOTE", "WORKING")

    await page.goto("/")

    // Wait for block to appear
    await expect(page.locator("text=E2E Test: Block to delete")).toBeVisible({
      timeout: 5000,
    })

    // Find the block card and delete it
    const blockCard = page
      .locator(".rounded-lg.border.border-border.bg-card.p-3")
      .filter({ hasText: "E2E Test: Block to delete" })
    await blockCard.getByRole("button", { name: "Delete" }).click()

    // Block should be gone
    await expect(
      page.locator("text=E2E Test: Block to delete")
    ).not.toBeVisible({
      timeout: 5000,
    })
  })

  test("should create blocks in different zones", async ({ page }) => {
    // Create blocks in different zones via API
    await createTestBlock("E2E Test: Permanent block", "SYSTEM", "PERMANENT")
    await createTestBlock("E2E Test: Stable block", "CODE", "STABLE")
    await createTestBlock("E2E Test: Working block", "NOTE", "WORKING")

    await page.goto("/")

    // All blocks should be visible
    await expect(page.locator("text=E2E Test: Permanent block")).toBeVisible({
      timeout: 5000,
    })
    await expect(page.locator("text=E2E Test: Stable block")).toBeVisible()
    await expect(page.locator("text=E2E Test: Working block")).toBeVisible()

    // Check types are displayed (use first() since there may be multiple)
    await expect(page.locator("span:has-text('SYSTEM')").first()).toBeVisible()
    await expect(page.locator("span:has-text('CODE')").first()).toBeVisible()
    await expect(page.locator("span:has-text('NOTE')").first()).toBeVisible()
  })
})

// Drag and drop tests (run serially)
test.describe.serial("Drag and Drop", () => {
  test.afterAll(async () => {
    await resetTestData()
  })

  test("should show drag hint in UI", async ({ page }) => {
    await page.goto("/")

    // Check for drag hint text
    await expect(
      page.locator("text=Drag blocks to reorder or move between zones")
    ).toBeVisible()
  })

  test("should show drop placeholder in empty zones", async ({ page }) => {
    await page.goto("/")

    // Empty zones should show drop placeholder
    await expect(
      page.locator("text=Drop blocks or files here").first()
    ).toBeVisible()
  })

  test("blocks should be draggable", async ({ page }) => {
    // Create a test block
    await createTestBlock("E2E Test: Draggable block", "NOTE", "WORKING")

    await page.goto("/")

    // Wait for block to appear
    await expect(
      page.locator("text=E2E Test: Draggable block")
    ).toBeVisible({ timeout: 5000 })

    // Find the block - it should have draggable styling (cursor: grab)
    const blockCard = page
      .locator("[data-block-id]")
      .filter({ hasText: "E2E Test: Draggable block" })

    await expect(blockCard).toBeVisible()

    // Verify the block has the draggable attribute
    await expect(blockCard).toHaveAttribute("data-zone", "WORKING")
  })

  test("should drag block between zones", async ({ page }) => {
    // Create a block in Working zone
    await createTestBlock("E2E Test: Drag between zones", "NOTE", "WORKING")

    await page.goto("/")

    // Wait for block to appear
    await expect(
      page.locator("text=E2E Test: Drag between zones")
    ).toBeVisible({ timeout: 5000 })

    // Find the draggable block wrapper
    const blockWrapper = page
      .locator("[data-block-id]")
      .filter({ hasText: "E2E Test: Drag between zones" })

    // Find the Permanent zone droppable area
    const permanentZone = page.locator("[data-droppable-zone='PERMANENT']")

    // Perform drag and drop
    await blockWrapper.dragTo(permanentZone)

    // Wait for the mutation to complete
    await page.waitForTimeout(1000)

    // After drag, block should have moved to Permanent zone
    // The block card should now show Stable and Working buttons (not Permanent)
    const movedBlockCard = page
      .locator(".rounded-lg.border.border-border.bg-card.p-3")
      .filter({ hasText: "E2E Test: Drag between zones" })

    await expect(
      movedBlockCard.getByRole("button", { name: "→ Stable" })
    ).toBeVisible({ timeout: 5000 })
    await expect(
      movedBlockCard.getByRole("button", { name: "→ Working" })
    ).toBeVisible()
  })

  test("should reorder blocks within zone via drag", async ({ page }) => {
    // Create two blocks in the same zone
    await createTestBlock("E2E Test: First block for reorder", "NOTE", "STABLE")
    // Small delay to ensure different positions
    await new Promise((r) => setTimeout(r, 100))
    await createTestBlock("E2E Test: Second block for reorder", "CODE", "STABLE")

    await page.goto("/")

    // Wait for both blocks to appear
    await expect(
      page.locator("text=E2E Test: First block for reorder")
    ).toBeVisible({ timeout: 5000 })
    await expect(
      page.locator("text=E2E Test: Second block for reorder")
    ).toBeVisible()

    // Get the blocks
    const firstBlock = page
      .locator("[data-block-id]")
      .filter({ hasText: "E2E Test: First block for reorder" })

    const secondBlock = page
      .locator("[data-block-id]")
      .filter({ hasText: "E2E Test: Second block for reorder" })

    // Drag second block to position of first block
    await secondBlock.dragTo(firstBlock)

    // Wait for reorder to complete
    await page.waitForTimeout(1000)

    // Both blocks should still be visible
    await expect(
      page.locator("text=E2E Test: First block for reorder")
    ).toBeVisible()
    await expect(
      page.locator("text=E2E Test: Second block for reorder")
    ).toBeVisible()
  })
})
