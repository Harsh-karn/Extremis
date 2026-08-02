import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Campaign Workflow E2E', () => {
  test('should successfully navigate the UI and handle API error gracefully', async ({ page }) => {
    // 1. Visit the homepage
    await page.goto('/');
    
    // Expect the title to contain Extremis
    await expect(page).toHaveTitle(/extremis/i);

    // 2. Step 1: Connect Gmail
    await expect(page.getByText('1. Connect Gmail')).toBeVisible();
    await page.getByPlaceholder('you@gmail.com').fill('fake_test_account@gmail.com');
    await page.getByPlaceholder('16-character app password').fill('abcdefghijklmnop');
    await page.getByRole('button', { name: 'Next Step' }).click();

    // 3. Step 2: Upload Audience
    await expect(page.getByText('2. Upload Audience')).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, 'fixtures', 'test-contacts.csv'));
    
    // Wait for success text and then click Next Step.
    await expect(page.getByText('File loaded successfully')).toBeVisible();
    await page.getByRole('button', { name: 'Next Step' }).click();

    // 4. Step 3: Compose Email & Preview
    await expect(page.getByText('3. Compose Email')).toBeVisible();
    
    // Fill subject and body using correct placeholders/labels
    await page.getByPlaceholder('Hello {{Name}}').fill('Hello {{FirstName}}');
    await page.getByLabel('Body').fill('Your discount is {{Discount}}');
    
    // The preview is shown on the same page at the bottom
    await expect(page.getByText('Hello Alice')).toBeVisible(); // Interpolated from row 1
    
    // 6. Start Batch and verify API error is handled gracefully
    await page.getByRole('button', { name: 'Start Sending Batch' }).click();

    // Verify it transitions to Step 4 (Results) and shows failure
    await expect(page.getByText('Batch Complete!')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Failed').first()).toBeVisible();
  });
});
