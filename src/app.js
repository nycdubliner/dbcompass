import { getDistance, getBearing } from './math.js';
import { fetchStations } from './api.js';
import { UI } from './ui.js';

// --- Configuration & Constants ---
const CONFIG = {
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
    
    deviceHeading: 0,
    headingBuffer: [],
    targetRotation: 0,
    currentRotation: 0,
    
    isSpinning: false,
    spinRotation: 0,
    dataReady: false,
    minSearchTimePassed: false,
    dataLoaded: false
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
    ui.startSearchAnimations();
    state.isSpinning = true;
    state.minSearchTimePassed = false;
    
    setTimeout(() => {
        state.minSearchTimePassed = true;
        checkReadiness();
    }, CONFIG.searchAnimationMinTimeMs);
    
    try {
        await requestPermissions();
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

function startSensors() {
    window.addEventListener('deviceorientation', handleOrientation, true);
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);

    navigator.geolocation.watchPosition(
        handleLocationUpdate,
        (err) => {
            console.error('Location error:', err);
            ui.showError('Error: Location access denied.');
        },
        { enableHighAccuracy: true }
    );
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
