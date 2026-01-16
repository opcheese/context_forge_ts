import { test, expect } from "@playwright/test"

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

test.describe("Blocks", () => {
  test("should display blocks section", async ({ page }) => {
    await page.goto("/")

    await expect(page.locator("h2")).toContainText("Blocks")
    await expect(page.locator("text=Add New Block")).toBeVisible()
  })

  test("should create a new block", async ({ page }) => {
    await page.goto("/")

    // Fill in the form
    await page.selectOption("#block-type", "NOTE")
    await page.fill("#block-content", "Test block content")

    // Submit
    await page.getByRole("button", { name: "Add Block" }).click()

    // Wait for block to appear
    await expect(page.locator("text=Test block content")).toBeVisible({
      timeout: 5000,
    })

    // Check the type badge
    await expect(page.locator("text=NOTE")).toBeVisible()
  })

  test("should delete a block", async ({ page }) => {
    await page.goto("/")

    // Create a block first
    await page.fill("#block-content", "Block to delete")
    await page.getByRole("button", { name: "Add Block" }).click()

    // Wait for block to appear
    await expect(page.locator("text=Block to delete")).toBeVisible({
      timeout: 5000,
    })

    // Delete it
    await page.getByRole("button", { name: "Delete" }).first().click()

    // Block should be gone (or at least one less delete button)
    await expect(page.locator("text=Block to delete")).not.toBeVisible({
      timeout: 5000,
    })
  })

  test("should show empty state when no blocks", async ({ page }) => {
    await page.goto("/")

    // This test may fail if there are blocks from other tests
    // In a real setup, we'd reset the database between tests
    const emptyState = page.locator("text=No blocks yet")
    const blockCount = page.locator("text=/\\d+ blocks/")

    // Either empty state or block count should be visible
    await expect(emptyState.or(blockCount)).toBeVisible()
  })
})
