// The API_KEY will be provided via a separate config.js or injected during build
const getApiUrl = () => {
    // Fallback to the user's provided key if the injected config is missing
    const key = window.DB_API_KEY || '4cb16cc25629379a9b853bdd1c55e7b86a203839';
    return `https://api.jcdecaux.com/vls/v1/stations?contract=dublin&apiKey=${key}`;
};

let stations = [];
let userCoords = null;
let nearestStation = null;
let deviceHeading = 0; 
let targetRotation = 0; 
let currentRotation = 0; 
let dataLoaded = false;
let distanceInterval = null;
let isSpinning = false;
let spinRotation = 0;
let minSearchTimePassed = false;
let dataReady = false;
let targetDistance = 0;
let bikesInterval = null;

// Stabilization settings
const SMOOTHING_FACTOR = 0.08; // Lower = smoother (slower to "catch up")
const HEADING_BUFFER_SIZE = 20; // Avg over last 20 readings (~1-2 seconds)
let headingBuffer = [];

// DOM Elements
const needle = document.getElementById('compass-needle');
const compassContainer = document.getElementById('compass-container');
const distanceDisplay = document.getElementById('distance-display');
const statusText = document.getElementById('status-text');
const stationNameEl = document.getElementById('station-name');
const bikesCountEl = document.getElementById('bikes-count');
const standsCountEl = document.getElementById('stands-count');
const stationInfoEl = document.getElementById('station-info');
const overlay = document.getElementById('permission-overlay');
const startBtn = document.getElementById('start-btn');

// Start bike/stand randomizing effect on load
bikesInterval = setInterval(() => {
    bikesCountEl.innerText = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    standsCountEl.innerText = String(Math.floor(Math.random() * 100)).padStart(2, '0');
}, 80);

// --- Initialization ---

startBtn.addEventListener('click', async () => {
    try {
        // Show loading state immediately
        overlay.classList.add('hidden');
        isSpinning = true;
        minSearchTimePassed = false;
        
        // Ensure the search animation runs for at least 0.5s
        setTimeout(() => {
            minSearchTimePassed = true;
            checkReady();
        }, 500);
        
        // Start distance counting-up effect
        let count = 1;
        distanceDisplay.innerText = '1m';
        distanceInterval = setInterval(() => {
            count += Math.floor(Math.random() * 5) + 1; // Randomly increment for "searching" feel
            distanceDisplay.innerText = count + 'm';
        }, 80);
        
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

        // Start smoothing loop
        requestAnimationFrame(updateSmoothing);
    } catch (err) {
        console.error('Initialization error:', err);
        alert('Failed to start. Please ensure you are on HTTPS and have granted permissions.');
    }
});

async function fetchStations() {
    try {
        const url = getApiUrl();
        const response = await fetch(url);
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
    targetDistance = minDistance;
    dataReady = true;
    checkReady();
}

function checkReady() {
    if (dataReady && isSpinning) {
        if (minSearchTimePassed) {
            isSpinning = false;
            dataLoaded = true;
            currentRotation = spinRotation % 360; // Handoff rotation
            if (distanceInterval) clearInterval(distanceInterval);
            if (bikesInterval) clearInterval(bikesInterval);
            updateUI(targetDistance);
        }
    } else if (dataLoaded) {
        updateUI(targetDistance); // Continuous updates as user moves
    }
}

function updateUI(distance) {
    if (!nearestStation) return;

    stationNameEl.innerText = nearestStation.name;
    stationNameEl.classList.add('loaded');
    
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

    // Add to circular buffer
    headingBuffer.push(heading);
    if (headingBuffer.length > HEADING_BUFFER_SIZE) {
        headingBuffer.shift();
    }

    // Circular Averaging: Average the vectors (Sin/Cos) to avoid North (360/0) jump issues
    let sumSin = 0;
    let sumCos = 0;
    
    headingBuffer.forEach(h => {
        const rad = h * Math.PI / 180;
        sumSin += Math.sin(rad);
        sumCos += Math.cos(rad);
    });
    
    const avgRad = Math.atan2(sumSin, sumCos);
    deviceHeading = (avgRad * 180 / Math.PI + 360) % 360;

    updateCompass();
}

function updateCompass() {
    if (!userCoords || !nearestStation) return;

    const bearing = getBearing(
        userCoords.lat, userCoords.lng,
        nearestStation.position.lat, nearestStation.position.lng
    );

    // Rotation is: Bearing to target - Device Heading
    targetRotation = bearing - deviceHeading;
}

// Low-pass filter for smooth needle movement
function updateSmoothing() {
    if (isSpinning) {
        spinRotation = (spinRotation + 1) % 360; // 60fps * 1 = 60 deg/sec = 6s per rotation
        needle.style.transform = `rotate(${spinRotation}deg)`;
    } else if (dataLoaded) {
        // Find the shortest path for rotation (handle 360-degree wrap)
        let delta = targetRotation - currentRotation;
        
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;

        // Apply smoothing
        currentRotation += delta * SMOOTHING_FACTOR;
        
        // Update needle
        needle.style.transform = `rotate(${currentRotation}deg)`;
    }

    requestAnimationFrame(updateSmoothing);
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

// Set deployment timestamp on load
window.addEventListener('load', () => {
    const deployEl = document.getElementById('deploy-time');
    if (window.DEPLOY_TIME) {
        deployEl.innerText = `Last deployed: ${window.DEPLOY_TIME}`;
    } else {
        deployEl.innerText = 'Last deployed: Unknown (Check build status)';
    }
});
