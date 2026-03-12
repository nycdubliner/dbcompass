import { describe, it, expect } from 'vitest';
import { getDistance, getBearing } from '../src/math.js';

describe('math utilities', () => {
    it('calculates distance correctly (Dublin to Cork)', () => {
        // Distance from Dublin to Cork is approx 219km
        const dist = getDistance(53.349805, -6.260310, 51.8985, -8.4756);
        expect(dist).toBeGreaterThan(218000);
        expect(dist).toBeLessThan(221000);
    });

    it('calculates bearing correctly (Dublin to Cork)', () => {
        // Dublin to Cork is roughly south-west (around 219 degrees)
        const bearing = getBearing(53.349805, -6.260310, 51.8985, -8.4756);
        expect(bearing).toBeGreaterThan(215);
        expect(bearing).toBeLessThan(225);
    });
    
    it('returns 0 distance for same point', () => {
        const dist = getDistance(53.3498, -6.2603, 53.3498, -6.2603);
        expect(dist).toBe(0);
    });
});
