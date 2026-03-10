import { getDistance, getBearing } from './math.js';
import { fetchStations } from './api.js';
import { UI } from './ui.js';

// --- Configuration & Constants ---
const CONFIG = {
    apiKey: window.DB_API_KEY,
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
    
    deviceHeading: 0,
    headingBuffer: [],
    targetRotation: 0,
    currentRotation: 0,
    
    isSpinning: false,
    spinRotation: 0,
    dataReady: false,
    minSearchTimePassed: false,
    dataLoaded: false,
    hasVibratedNear: false
};

const ui = new UI();

// --- Initialization ---
function init() {
    ui.setDeployTime(window.DEPLOY_TIME);
    ui.startIdleAnimations();
    ui.onStartTracking(handleStartTracking);
}

// --- Event Handlers ---
async function handleStartTracking() {
    if (!CONFIG.apiKey || CONFIG.apiKey === 'INJECT_API_KEY') {
        ui.showError('Error: Invalid API Key. Check deployment configuration.');
        return;
    }

    ui.startSearchAnimations();
    state.isSpinning = true;
    state.minSearchTimePassed = false;
    
    setTimeout(() => {
        state.minSearchTimePassed = true;
        checkReadiness();
    }, CONFIG.searchAnimationMinTimeMs);
    
    try {
        await requestPermissions();
        await requestWakeLock();
        startSensors();
        await loadStations();
        
        setInterval(loadStations, CONFIG.refreshIntervalMs);
        requestAnimationFrame(renderCompass);
    } catch (err) {
        console.error('Initialization error:', err);
        alert('Failed to start. Please ensure you are on HTTPS and have granted permissions.');
    }
}

// --- Permissions & Sensors ---
async function requestPermissions() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') {
            throw new Error('Orientation permission denied');
        }
    }
    
    if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported');
    }
}

async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            await navigator.wakeLock.request('screen');
            console.log('Wake Lock is active!');
            
            // Re-request if the page becomes visible again
            document.addEventListener('visibilitychange', async () => {
                if (document.visibilityState === 'visible') {
                    await navigator.wakeLock.request('screen');
                }
            });
        } catch (err) {
            console.warn('Wake Lock request failed:', err);
        }
    }
}

function startSensors() {
    if ('AbsoluteOrientationSensor' in window) {
        try {
            const sensor = new AbsoluteOrientationSensor({ frequency: 60 });
            sensor.addEventListener('reading', () => {
                // Sensor quaternion to heading calculation
                const q = sensor.quaternion;
                if (!q) return;
                
                // Extract yaw (heading) from quaternion
                const heading = Math.atan2(2 * (q[0]*q[1] + q[2]*q[3]), 1 - 2 * (q[1]*q[1] + q[2]*q[2]));
                let headingDeg = heading * (180 / Math.PI);
                if (headingDeg < 0) headingDeg += 360;
                
                processHeading(headingDeg);
            });
            sensor.addEventListener('error', (error) => {
                if (error.name === 'NotAllowedError') {
                    console.error('Permission to access sensor was denied.');
                } else if (error.name === 'NotReadableError') {
                    console.error('Cannot connect to the sensor.');
                }
                fallbackToLegacyOrientation();
            });
            sensor.start();
        } catch (error) {
            console.error('Sensor error:', error);
            fallbackToLegacyOrientation();
        }
    } else {
        fallbackToLegacyOrientation();
    }

    navigator.geolocation.watchPosition(
        handleLocationUpdate,
        (err) => {
            console.error('Location error:', err);
            ui.showError('Error: Location access denied.');
        },
        { enableHighAccuracy: true }
    );
}

function fallbackToLegacyOrientation() {
    window.addEventListener('deviceorientation', handleOrientation, true);
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
}

// --- Data Fetching ---
async function loadStations() {
    try {
        state.stations = await fetchStations(CONFIG.contractName, CONFIG.apiKey);
        if (state.userLocation) {
            calculateNearestStation();
        }
    } catch (err) {
        console.error('API Error:', err);
        ui.showError('Error fetching bike data.');
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
    let heading = event.webkitCompassHeading || (360 - event.alpha);
    if (heading === undefined || heading === null) return;
    processHeading(heading);
}

function processHeading(heading) {
    state.headingBuffer.push(heading);
    if (state.headingBuffer.length > CONFIG.headingBufferSize) {
        state.headingBuffer.shift();
    }

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

    // Check if the nearest station is too far away (e.g., > 50km)
    if (minDistance > 50000) {
        ui.showError('No stations nearby. Are you in Dublin?');
        ui.stopAnimations();
        return;
    }

    if (minDistance < 50 && !state.hasVibratedNear) {
        state.hasVibratedNear = true;
        if ('vibrate' in navigator) {
            navigator.vibrate([100, 50, 100]); // Double vibration when close
        }
    } else if (minDistance >= 50) {
        state.hasVibratedNear = false; // Reset if they walk away
    }

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

    state.targetRotation = bearing - state.deviceHeading;
}

// --- Render Loop ---
function checkReadiness() {
    if (state.dataReady && state.isSpinning) {
        if (state.minSearchTimePassed) {
            transitionToLiveTracking();
        }
    } else if (state.dataLoaded) {
        ui.updateLiveStation(state.nearestStation, state.targetDistance);
    }
}

function transitionToLiveTracking() {
    state.isSpinning = false;
    state.dataLoaded = true;
    
    state.currentRotation = state.spinRotation % 360; 
    
    ui.stopAnimations();
    ui.updateLiveStation(state.nearestStation, state.targetDistance);
    
    if ('vibrate' in navigator) {
        navigator.vibrate(50); // Lock on vibration
    }
}

function renderCompass() {
    if (state.isSpinning) {
        state.spinRotation = (state.spinRotation + 1) % 360; 
        ui.updateCompass(state.spinRotation);
    } else if (state.dataLoaded) {
        let delta = state.targetRotation - state.currentRotation;
        
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;

        state.currentRotation += delta * CONFIG.smoothingFactor;
        ui.updateCompass(state.currentRotation);
    }

    requestAnimationFrame(renderCompass);
}

window.addEventListener('DOMContentLoaded', init);
