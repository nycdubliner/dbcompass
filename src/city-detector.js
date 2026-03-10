// src/city-detector.js

const CITIES = [
    {
        name: 'dublin',
        // Bounding box for Dublin (approx)
        minLat: 53.2, maxLat: 53.5,
        minLng: -6.5, maxLng: -6.0
    },
    {
        name: 'paris',
        // Bounding box for Paris (approx)
        minLat: 48.7, maxLat: 49.0,
        minLng: 2.1, maxLng: 2.5
    },
    {
        name: 'brisbane',
        // Bounding box for Brisbane (approx)
        minLat: -27.6, maxLat: -27.3,
        minLng: 152.9, maxLng: 153.2
    },
    {
        name: 'seville',
        // Bounding box for Seville
        minLat: 37.3, maxLat: 37.5,
        minLng: -6.1, maxLng: -5.8
    }
];

export function detectCity(lat, lng) {
    for (const city of CITIES) {
        if (lat >= city.minLat && lat <= city.maxLat && 
            lng >= city.minLng && lng <= city.maxLng) {
            return city.name;
        }
    }
    
    // Default to Dublin if outside known boxes, or we could return null
    return 'dublin';
}
