import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  globalSetup: './scripts/prepare-test-fonts.mjs',
  timeout: 30000,
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:8080', viewport: { width: 1000, height: 800 } },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } } },
    { name: 'firefox', use: { browserName: 'firefox', launchOptions: { firefoxUserPrefs: { 'webgl.force-enabled': true, 'webgl.software': true } } } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: { command: 'npm start', url: 'http://127.0.0.1:8080', reuseExistingServer: !process.env.CI },
  reporter: [['list'], ['junit', { outputFile: 'test-results/browser.xml' }]],
});
