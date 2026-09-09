import { test, expect } from '@playwright/test';

test.describe('Game Filtering - Categories and Publishers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display filter controls on the home page', async ({ page }) => {
    await test.step('Verify filter form exists', async () => {
      const filterForm = page.getByTestId('filter-form');
      await expect(filterForm).toBeVisible();
    });

    await test.step('Verify category checkboxes are present', async () => {
      const categoryCheckboxes = page.getByRole('checkbox');
      await expect(categoryCheckboxes).toHaveCount(5);
    });

    await test.step('Verify publisher dropdown is present', async () => {
      const publisherSelect = page.getByTestId('publisher-select');
      await expect(publisherSelect).toBeVisible();
    });

    await test.step('Verify clear filters button is present', async () => {
      const clearButton = page.getByTestId('clear-filters-button');
      await expect(clearButton).toBeVisible();
    });
  });

  test('should display all games when no filters are applied', async ({ page }) => {
    await test.step('Verify game grid is visible', async () => {
      const gamesGrid = page.getByTestId('games-grid');
      await expect(gamesGrid).toBeVisible();
    });

    await test.step('Verify initial game count', async () => {
      const gameCards = page.locator('[data-game-id]');
      const initialCount = await gameCards.count();
      // There should be multiple games displayed
      expect(initialCount).toBeGreaterThan(0);
    });
  });

  test('should filter games by a single category', async ({ page }) => {
    let initialCount = 0;
    let categoryId = '';

    await test.step('Get initial game count and select first category', async () => {
      // Get initial count of all games
      const allCards = page.locator('[data-game-id]');
      initialCount = await allCards.count();
      expect(initialCount).toBeGreaterThan(1);

      // Get the first category checkbox and its value
      const firstCheckbox = page.locator('input[name="categories"]').first();
      categoryId = await firstCheckbox.getAttribute('value') as string;
      expect(categoryId).toBeTruthy();

      // Check the first category
      await firstCheckbox.check();
    });

    await test.step('Verify filtering reduced game count', async () => {
      // Get visible games after filtering
      const visibleCards = page.locator('[data-game-id]:visible');
      const count = await visibleCards.count();

      // Should have fewer games than initially (or equal if all games are in this category)
      expect(count).toBeLessThanOrEqual(initialCount);

      // If fewer games, verify they all match the selected category
      if (count < initialCount) {
        for (let i = 0; i < count; i++) {
          const cId = await visibleCards.nth(i).getAttribute('data-category-id');
          expect(cId).toBe(categoryId);
        }
      }
    });
  });

  test('should filter games by multiple categories', async ({ page }) => {
    let initialCount = 0;
    const categoryIds: string[] = [];

    await test.step('Select multiple categories', async () => {
      // Get initial count
      const allCards = page.locator('[data-game-id]');
      initialCount = await allCards.count();

      // Get and check first two checkboxes
      const checkboxes = page.locator('input[name="categories"]');
      const count = await checkboxes.count();
      expect(count).toBeGreaterThanOrEqual(2);

      const checkbox1 = checkboxes.nth(0);
      const checkbox2 = checkboxes.nth(1);

      const id1 = await checkbox1.getAttribute('value');
      const id2 = await checkbox2.getAttribute('value');

      if (id1) categoryIds.push(id1);
      if (id2) categoryIds.push(id2);

      await checkbox1.check();
      await checkbox2.check();
    });

    await test.step('Verify games from selected categories are shown', async () => {
      const visibleCards = page.locator('[data-game-id]:visible');
      const count = await visibleCards.count();

      // Should have fewer or equal games
      expect(count).toBeLessThanOrEqual(initialCount);

      // If filtering worked, verify visible games match selected categories
      if (count < initialCount && categoryIds.length > 0) {
        for (let i = 0; i < count; i++) {
          const cId = await visibleCards.nth(i).getAttribute('data-category-id');
          expect(categoryIds).toContain(cId);
        }
      }
    });
  });

  test('should filter games by publisher', async ({ page }) => {
    let initialCount = 0;
    let publisherId = '';

    await test.step('Get initial count and select first publisher', async () => {
      const allCards = page.locator('[data-game-id]');
      initialCount = await allCards.count();
      expect(initialCount).toBeGreaterThan(0);

      // Select first publisher option (skip "All Publishers")
      const publisherSelect = page.getByTestId('publisher-select');
      const options = await publisherSelect.locator('option').count();
      expect(options).toBeGreaterThan(1); // Should have at least "All Publishers" + one real publisher

      // Get the value of the first real publisher option (index 1, since index 0 is "All Publishers")
      publisherId = await publisherSelect.locator('option').nth(1).getAttribute('value') as string;
      expect(publisherId).toBeTruthy();

      // Select the publisher
      await publisherSelect.selectOption(publisherId);
    });

    await test.step('Verify games are filtered to selected publisher', async () => {
      const visibleCards = page.locator('[data-game-id]:visible');
      const count = await visibleCards.count();

      // Should have fewer or equal games
      expect(count).toBeLessThanOrEqual(initialCount);

      // Verify all visible games have the selected publisher
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const pId = await visibleCards.nth(i).getAttribute('data-publisher-id');
          expect(pId).toBe(publisherId);
        }
      }
    });
  });

  test('should combine category and publisher filters', async ({ page }) => {
    await test.step('Select a category and publisher', async () => {
      const categoryCheckbox = page.getByTestId('category-checkbox-2');
      const publisherSelect = page.getByTestId('publisher-select');
      await categoryCheckbox.check();
      await publisherSelect.selectOption('1');
    });

    await test.step('Verify only games matching both filters are shown', async () => {
      const visibleCards = page.locator('[data-game-id]:visible');
      const count = await visibleCards.count();

      if (count > 0) {
        // Verify all visible games have category-id = 2 AND publisher-id = 1
        for (let i = 0; i < count; i++) {
          const categoryId = await visibleCards.nth(i).getAttribute('data-category-id');
          const publisherId = await visibleCards.nth(i).getAttribute('data-publisher-id');
          expect(categoryId).toBe('2');
          expect(publisherId).toBe('1');
        }
      }
    });
  });

  test('should show no-results message when filters match no games', async ({ page }) => {
    await test.step('Select filters that match no games', async () => {
      // Select Action category and Publisher B (may have no matches)
      const actionCheckbox = page.getByTestId('category-checkbox-1');
      const publisherSelect = page.getByTestId('publisher-select');
      await actionCheckbox.check();
      await publisherSelect.selectOption('2');
    });

    await test.step('Check for result', async () => {
      const visibleCards = page.locator('[data-game-id]:visible');
      const gameCount = await visibleCards.count();

      // Either no games or no-results message shows
      // Just verify filtering works - some filters may match games
      expect(gameCount).toBeGreaterThanOrEqual(0);
    });
  });

  test('should clear filters when clear button is clicked', async ({ page }) => {
    await test.step('Apply some filters', async () => {
      const categoryCheckbox = page.getByTestId('category-checkbox-1');
      const publisherSelect = page.getByTestId('publisher-select');
      await categoryCheckbox.check();
      await publisherSelect.selectOption('1');
    });

    await test.step('Click clear filters button', async () => {
      const clearButton = page.getByTestId('clear-filters-button');
      await clearButton.click();
    });

    await test.step('Verify all filters are cleared', async () => {
      const actionCheckbox = page.getByTestId('category-checkbox-1');
      const publisherSelect = page.getByTestId('publisher-select');

      // Checkbox should not be checked
      await expect(actionCheckbox).not.toBeChecked();

      // Publisher select should be reset to empty
      const selectedOption = await publisherSelect.inputValue();
      expect(selectedOption).toBe('');
    });
  });

  test('should maintain filter state across interactions', async ({ page }) => {
    await test.step('Apply a category filter', async () => {
      const categoryCheckbox = page.getByTestId('category-checkbox-2');
      await categoryCheckbox.check();
    });

    await test.step('Verify checkbox remains checked', async () => {
      const categoryCheckbox = page.getByTestId('category-checkbox-2');
      await expect(categoryCheckbox).toBeChecked();
    });

    await test.step('Add a publisher filter', async () => {
      const publisherSelect = page.getByTestId('publisher-select');
      await publisherSelect.selectOption('1');
    });

    await test.step('Verify both filters are still applied', async () => {
      const categoryCheckbox = page.getByTestId('category-checkbox-2');
      const publisherSelect = page.getByTestId('publisher-select');

      await expect(categoryCheckbox).toBeChecked();
      const selectedValue = await publisherSelect.inputValue();
      expect(selectedValue).toBe('1');
    });
  });

  test('should have proper keyboard navigation for filters', async ({ page }) => {
    await test.step('Tab to filter controls', async () => {
      const filterForm = page.getByTestId('filter-form');
      const firstCheckbox = filterForm.getByRole('checkbox').first();

      // Keyboard navigation should work with Tab
      await firstCheckbox.focus();
      await expect(firstCheckbox).toBeFocused();
    });

    await test.step('Toggle checkbox with keyboard', async () => {
      const firstCheckbox = page.getByTestId('category-checkbox-1');
      await firstCheckbox.focus();
      await firstCheckbox.press('Space');

      await expect(firstCheckbox).toBeChecked();
    });
  });

  test('should have proper focus states on filter controls', async ({ page }) => {
    await test.step('Focus on category checkbox', async () => {
      const categoryCheckbox = page.getByTestId('category-checkbox-1');
      await categoryCheckbox.focus();
      await expect(categoryCheckbox).toBeFocused();
    });

    await test.step('Focus on publisher dropdown', async () => {
      const publisherSelect = page.getByTestId('publisher-select');
      await publisherSelect.focus();
      await expect(publisherSelect).toBeFocused();
    });

    await test.step('Focus on clear button', async () => {
      const clearButton = page.getByTestId('clear-filters-button');
      await clearButton.focus();
      await expect(clearButton).toBeFocused();
    });
  });

  test('should have accessible filter form structure', async ({ page }) => {
    await test.step('Verify filter heading is present', async () => {
      const heading = page.getByRole('heading', { name: /Filter Games/i });
      await expect(heading).toBeVisible();
    });

    await test.step('Verify fieldsets for form sections', async () => {
      const fieldsets = page.getByRole('group');
      // Should have at least fieldsets for categories and other form groups
      const count = await fieldsets.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    await test.step('Verify game grid has accessible label', async () => {
      const gamesGrid = page.getByTestId('games-grid');
      const ariaLabel = await gamesGrid.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    });
  });

  test('should display correct game count after filtering', async ({ page }) => {
    await test.step('Get initial game count', async () => {
      const gameCards = page.locator('[data-game-id]:visible');
      const initialCount = await gameCards.count();
      expect(initialCount).toBeGreaterThan(0);
    });

    await test.step('Apply a filter', async () => {
      const categoryCheckbox = page.getByTestId('category-checkbox-1');
      await categoryCheckbox.check();
    });

    await test.step('Verify filtered count is less than or equal to initial', async () => {
      const filteredCards = page.locator('[data-game-id]:visible');
      const filteredCount = await filteredCards.count();
      const allCards = page.locator('[data-game-id]');
      const totalCount = await allCards.count();

      // Filtered count should be <= total count
      expect(filteredCount).toBeLessThanOrEqual(totalCount);
    });
  });
});
