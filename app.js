const API_KEY = '4cb16cc25629379a9b853bdd1c55e7b86a203839';
const CONTRACT_NAME = 'dublin';
const API_URL = `https://api.jcdecaux.com/vls/v1/stations?contract=${CONTRACT_NAME}&apiKey=${API_KEY}`;

let stations = [];
let userCoords = null;
let nearestStation = null;
let deviceHeading = 0; // Magnetic north heading

// DOM Elements
const needle = document.getElementById('compass-needle');
const distanceDisplay = document.getElementById('distance-display');
const statusText = document.getElementById('status-text');
const stationNameEl = document.getElementById('station-name');
const bikesCountEl = document.getElementById('bikes-count');
const standsCountEl = document.getElementById('stands-count');
const stationInfoEl = document.getElementById('station-info');
const overlay = document.getElementById('permission-overlay');
const startBtn = document.getElementById('start-btn');

// --- Initialization ---

startBtn.addEventListener('click', async () => {
    try {
        // 1. Request Orientation Permission (iOS 13+)
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission !== 'granted') {
                alert('Orientation permission is required for the compass to work.');
                return;
            }
        }

        // 2. Start tracking orientation
        window.addEventListener('deviceorientation', handleOrientation, true);
        window.addEventListener('deviceorientationabsolute', handleOrientation, true);

        // 3. Get Geolocation
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser.');
            return;
        }

        navigator.geolocation.watchPosition(
            updateUserLocation,
            (err) => {
                console.error('Location error:', err);
                statusText.innerText = 'Error: Location access denied.';
            },
            { enableHighAccuracy: true }
        );

        // 4. Fetch Station Data
        await fetchStations();
        setInterval(fetchStations, 30000); // Refresh every 30s

        // Hide overlay
        overlay.classList.add('hidden');
    } catch (err) {
        console.error('Initialization error:', err);
        alert('Failed to start. Please ensure you are on HTTPS and have granted permissions.');
    }
});

async function fetchStations() {
    try {
        const response = await fetch(API_URL);
        stations = await response.json();
        if (userCoords) findNearestStation();
    } catch (err) {
        console.error('API Error:', err);
        statusText.innerText = 'Error fetching bike data.';
    }
}

function updateUserLocation(position) {
    userCoords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
    };
    if (stations.length > 0) findNearestStation();
}

function findNearestStation() {
    if (!userCoords || stations.length === 0) return;

    let minDistance = Infinity;
    let closest = null;

    stations.forEach(station => {
        const dist = getDistance(
            userCoords.lat, userCoords.lng,
            station.position.lat, station.position.lng
        );
        if (dist < minDistance) {
            minDistance = dist;
            closest = station;
        }
    });

    nearestStation = closest;
    updateUI(minDistance);
}

function updateUI(distance) {
    if (!nearestStation) return;

    stationInfoEl.classList.remove('hidden');
    stationNameEl.innerText = nearestStation.name;
    bikesCountEl.innerText = nearestStation.available_bikes;
    standsCountEl.innerText = nearestStation.available_bike_stands;

    // Display distance nicely
    if (distance >= 1000) {
        distanceDisplay.innerText = (distance / 1000).toFixed(1) + 'km';
    } else {
        distanceDisplay.innerText = Math.round(distance) + 'm';
    }

    statusText.innerText = 'Pointing to nearest station';
}

function handleOrientation(event) {
    // webkitCompassHeading is the most reliable for iOS
    // alpha is used for Android (though it requires absolute orientation)
    let heading = event.webkitCompassHeading || (360 - event.alpha);

    if (heading === undefined || heading === null) return;

    deviceHeading = heading;
    updateCompass();
}

function updateCompass() {
    if (!userCoords || !nearestStation) return;

    const bearing = getBearing(
        userCoords.lat, userCoords.lng,
        nearestStation.position.lat, nearestStation.position.lng
    );

    // The rotation of the needle should be: Bearing to target - Device Heading
    // This makes the needle point at the target relative to where the phone is pointing.
    const rotation = bearing - deviceHeading;
    needle.style.transform = `rotate(${rotation}deg)`;
}

// --- Math Utilities ---

// Haversine formula to get distance in meters
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// Calculate bearing (initial heading) in degrees
function getBearing(lat1, lon1, lat2, lon2) {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const λ1 = lon1 * Math.PI / 180;
    const λ2 = lon2 * Math.PI / 180;

    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
    const θ = Math.atan2(y, x);

    return (θ * 180 / Math.PI + 360) % 360; // range 0-360
}
