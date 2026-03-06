/**
 * DBCompass - Dublin Bikes Navigation
 * Core Application Logic
 */

// --- Configuration & Constants ---
const CONFIG = {
    // API_KEY is provided via deployment injection
    apiKey: window.DB_API_KEY || '4cb16cc25629379a9b853bdd1c55e7b86a203839',
    contractName: 'dublin',
    refreshIntervalMs: 30000,
    searchAnimationMinTimeMs: 500,
    smoothingFactor: 0.08,
    headingBufferSize: 20
};

// --- Application State ---
const state = {
    stations: [],
    userLocation: null,
    nearestStation: null,
    targetDistance: 0,
    
    // Compass State
    deviceHeading: 0,
    headingBuffer: [],
    targetRotation: 0,
    currentRotation: 0,
    
    // Animation State
    isSpinning: false,
    spinRotation: 0,
    dataReady: false,
    minSearchTimePassed: false,
    dataLoaded: false,
    
    // Interval IDs
    distanceInterval: null,
    bikesInterval: null
};

// --- DOM Elements ---
const dom = {
    needle: document.getElementById('compass-needle'),
    distanceDisplay: document.getElementById('distance-display'),
    statusText: document.getElementById('status-text'),
    stationName: document.getElementById('station-name'),
    bikesCount: document.getElementById('bikes-count'),
    standsCount: document.getElementById('stands-count'),
    overlay: document.getElementById('permission-overlay'),
    startBtn: document.getElementById('start-btn'),
    deployTime: document.getElementById('deploy-time')
};

// --- Initialization ---
function init() {
    // Set deployment timestamp on load
    if (window.DEPLOY_TIME) {
        dom.deployTime.innerText = `Last deployed: ${window.DEPLOY_TIME}`;
    } else {
        dom.deployTime.innerText = 'Last deployed: Unknown (Check build status)';
    }

    // Start background UI effects (randomizing numbers)
    startIdleAnimations();

    // Bind event listeners
    dom.startBtn.addEventListener('click', handleStartTracking);
}

// --- Event Handlers ---
async function handleStartTracking() {
    startSearchAnimations();
    
    try {
        await requestPermissions();
        startSensors();
        await fetchStations();
        
        // Refresh data periodically
        setInterval(fetchStations, CONFIG.refreshIntervalMs);
        
        // Start the continuous compass rendering loop
        requestAnimationFrame(renderCompass);
    } catch (err) {
        console.error('Initialization error:', err);
        alert('Failed to start. Please ensure you are on HTTPS and have granted permissions.');
    }
}

// --- Permissions & Sensors ---
async function requestPermissions() {
    // Request Orientation Permission (iOS 13+)
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') {
            throw new Error('Orientation permission denied');
        }
    }
    
    // Check Geolocation Support
    if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported');
    }
}

function startSensors() {
    // Start tracking device orientation
    window.addEventListener('deviceorientation', handleOrientation, true);
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);

    // Start tracking user location
    navigator.geolocation.watchPosition(
        handleLocationUpdate,
        (err) => {
            console.error('Location error:', err);
            dom.statusText.innerText = 'Error: Location access denied.';
        },
        { enableHighAccuracy: true }
    );
}

// --- Data Fetching ---
async function fetchStations() {
    try {
        const url = `https://api.jcdecaux.com/vls/v1/stations?contract=${CONFIG.contractName}&apiKey=${CONFIG.apiKey}`;
        const response = await fetch(url);
        state.stations = await response.json();
        
        if (state.userLocation) {
            calculateNearestStation();
        }
    } catch (err) {
        console.error('API Error:', err);
        dom.statusText.innerText = 'Error fetching bike data.';
    }
}

// --- Logic & Math ---
function handleLocationUpdate(position) {
    state.userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
    };
    
    if (state.stations.length > 0) {
        calculateNearestStation();
    }
}

function handleOrientation(event) {
    // webkitCompassHeading is the most reliable for iOS
    // alpha is used for Android (though it requires absolute orientation)
    let heading = event.webkitCompassHeading || (360 - event.alpha);

    if (heading === undefined || heading === null) return;

    // Add to circular buffer for stabilization
    state.headingBuffer.push(heading);
    if (state.headingBuffer.length > CONFIG.headingBufferSize) {
        state.headingBuffer.shift();
    }

    // Circular Averaging: Average the vectors (Sin/Cos) to avoid North (360/0) jump issues
    let sumSin = 0;
    let sumCos = 0;
    
    state.headingBuffer.forEach(h => {
        const rad = h * Math.PI / 180;
        sumSin += Math.sin(rad);
        sumCos += Math.cos(rad);
    });
    
    const avgRad = Math.atan2(sumSin, sumCos);
    state.deviceHeading = (avgRad * 180 / Math.PI + 360) % 360;

    updateTargetRotation();
}

function calculateNearestStation() {
    if (!state.userLocation || state.stations.length === 0) return;

    let minDistance = Infinity;
    let closest = null;

    state.stations.forEach(station => {
        const dist = getDistance(
            state.userLocation.lat, state.userLocation.lng,
            station.position.lat, station.position.lng
        );
        if (dist < minDistance) {
            minDistance = dist;
            closest = station;
        }
    });

    state.nearestStation = closest;
    state.targetDistance = minDistance;
    state.dataReady = true;
    
    updateTargetRotation();
    checkReadiness();
}

function updateTargetRotation() {
    if (!state.userLocation || !state.nearestStation) return;

    const bearing = getBearing(
        state.userLocation.lat, state.userLocation.lng,
        state.nearestStation.position.lat, state.nearestStation.position.lng
    );

    // Rotation is: Bearing to target - Device Heading
    state.targetRotation = bearing - state.deviceHeading;
}

// --- UI & Animations ---
function startIdleAnimations() {
    // Start bike/stand randomizing effect on load to show activity
    state.bikesInterval = setInterval(() => {
        dom.bikesCount.innerText = String(Math.floor(Math.random() * 100)).padStart(2, '0');
        dom.standsCount.innerText = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    }, 80);
}

function startSearchAnimations() {
    // Hide overlay immediately
    dom.overlay.classList.add('hidden');
    
    // Set state flags
    state.isSpinning = true;
    state.minSearchTimePassed = false;
    
    // Ensure the search animation runs for a minimum duration to avoid flickering
    setTimeout(() => {
        state.minSearchTimePassed = true;
        checkReadiness();
    }, CONFIG.searchAnimationMinTimeMs);
    
    // Start distance counting-up effect
    let count = 1;
    dom.distanceDisplay.innerText = '1m';
    state.distanceInterval = setInterval(() => {
        count += Math.floor(Math.random() * 5) + 1; // Randomly increment for "searching" feel
        dom.distanceDisplay.innerText = count + 'm';
    }, 80);
}

function checkReadiness() {
    // Wait until both the data is fetched and the minimum animation time has passed
    if (state.dataReady && state.isSpinning) {
        if (state.minSearchTimePassed) {
            transitionToLiveTracking();
        }
    } else if (state.dataLoaded) {
        // If already live, just update the UI with new values
        updateLiveData(); 
    }
}

function transitionToLiveTracking() {
    state.isSpinning = false;
    state.dataLoaded = true;
    
    // Handoff the rotation so the needle doesn't snap back to zero
    state.currentRotation = state.spinRotation % 360; 
    
    // Stop randomizing animations
    if (state.distanceInterval) clearInterval(state.distanceInterval);
    if (state.bikesInterval) clearInterval(state.bikesInterval);
    
    updateLiveData();
}

function updateLiveData() {
    if (!state.nearestStation) return;

    // Fade in station name
    dom.stationName.innerText = state.nearestStation.name;
    dom.stationName.classList.add('loaded');
    
    // Lock in exact numbers
    dom.bikesCount.innerText = state.nearestStation.available_bikes;
    dom.standsCount.innerText = state.nearestStation.available_bike_stands;

    // Display distance nicely formatted
    if (state.targetDistance >= 1000) {
        dom.distanceDisplay.innerText = (state.targetDistance / 1000).toFixed(1) + 'km';
    } else {
        dom.distanceDisplay.innerText = Math.round(state.targetDistance) + 'm';
    }

    dom.statusText.innerText = 'Pointing to nearest station';
}

function renderCompass() {
    if (state.isSpinning) {
        // Continuous slow spin while searching (60fps * 1 = 60 deg/sec = 6s per rotation)
        state.spinRotation = (state.spinRotation + 1) % 360; 
        dom.needle.style.transform = `rotate(${state.spinRotation}deg)`;
    } else if (state.dataLoaded) {
        // Apply low-pass filter for smooth needle movement
        // Find the shortest path for rotation (handle 360-degree wrap)
        let delta = state.targetRotation - state.currentRotation;
        
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;

        // Apply smoothing
        state.currentRotation += delta * CONFIG.smoothingFactor;
        
        // Update needle
        dom.needle.style.transform = `rotate(${state.currentRotation}deg)`;
    }

    requestAnimationFrame(renderCompass);
}

// --- Math Utilities ---

/**
 * Haversine formula to get distance in meters between two coordinates
 */
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

/**
 * Calculate bearing (initial heading) in degrees between two coordinates
 */
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

// Boot the application
window.addEventListener('load', init);
