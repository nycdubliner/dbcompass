import { test, expect } from '@playwright/test';

test.describe('DBCompass Layout & E2E', () => {
  test.use({
    geolocation: { latitude: 53.349805, longitude: -6.260310 },
    permissions: ['geolocation'],
  });

  test('app loads and displays correctly on different viewports', async ({ page }) => {
    // Mock device orientation since it's hard to trigger natively in headless
    await page.addInitScript(() => {
      window.DeviceOrientationEvent = class DeviceOrientationEvent extends Event {
        constructor(type, eventInitDict) {
          super(type, eventInitDict);
          this.alpha = eventInitDict?.alpha || null;
          this.beta = eventInitDict?.beta || null;
          this.gamma = eventInitDict?.gamma || null;
          this.webkitCompassHeading = eventInitDict?.webkitCompassHeading || null;
        }
        static requestPermission() {
          return Promise.resolve('granted');
        }
      };
      
      // Intercept fetch API to mock JCDecaux response
      const originalFetch = window.fetch;
      window.fetch = async (url, ...args) => {
        if (url.toString().includes('jcdecaux')) {
          return {
            ok: true,
            json: async () => [{
              name: 'MOCK STATION',
              position: { lat: 53.35, lng: -6.26 },
              available_bikes: 42,
              available_bike_stands: 10
            }]
          };
        }
        return originalFetch(url, ...args);
      };
    });

    await page.goto('/');
    
    // Check initial permission overlay
    await expect(page.locator('#permission-overlay')).toBeVisible();
    await expect(page).toHaveScreenshot('permission-overlay.png', { maxDiffPixelRatio: 0.1 });

    // Click start and simulate orientation event
    await page.click('#start-btn');
    
    await page.evaluate(() => {
        const event = new DeviceOrientationEvent('deviceorientation', {
            webkitCompassHeading: 45
        });
        window.dispatchEvent(event);
    });

    // Wait for the station name to load
    await page.waitForSelector('#station-name.loaded');
    await expect(page.locator('#station-name')).toHaveText('MOCK STATION');
    await expect(page.locator('#bikes-count')).toHaveText('42');
    
    // Stop random animations in the DOM to avoid flakiness
    await page.evaluate(() => {
      if (window.state && window.state.distanceInterval) {
        clearInterval(window.state.distanceInterval);
        window.state.isSpinning = false;
        window.state.dataLoaded = true;
      }
    });

    // Ensure compass spin animation is done to avoid flaky screenshots
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('live-tracking.png', { maxDiffPixelRatio: 0.1, threshold: 0.2 });
  });
});
