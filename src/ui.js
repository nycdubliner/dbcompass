// src/ui.js
export class UI {
    constructor() {
        this.dom = {
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
        
        // Randomization intervals
        this.distanceInterval = null;
        this.bikesInterval = null;
    }

    setDeployTime(timeStr) {
        if (timeStr) {
            this.dom.deployTime.innerText = `Last deployed: ${timeStr}`;
        } else {
            this.dom.deployTime.innerText = 'Last deployed: Unknown (Check build status)';
        }
    }

    onStartTracking(callback) {
        this.dom.startBtn.addEventListener('click', callback);
    }

    hideOverlay() {
        this.dom.overlay.classList.add('hidden');
    }

    startIdleAnimations() {
        this.bikesInterval = setInterval(() => {
            this.dom.bikesCount.innerText = String(Math.floor(Math.random() * 100)).padStart(2, '0');
            this.dom.standsCount.innerText = String(Math.floor(Math.random() * 100)).padStart(2, '0');
        }, 80);
    }

    startSearchAnimations() {
        this.hideOverlay();
        let count = 1;
        this.dom.distanceDisplay.innerText = '1m';
        this.distanceInterval = setInterval(() => {
            count += Math.floor(Math.random() * 5) + 1;
            this.dom.distanceDisplay.innerText = count + 'm';
        }, 80);
    }

    stopAnimations() {
        if (this.distanceInterval) clearInterval(this.distanceInterval);
        if (this.bikesInterval) clearInterval(this.bikesInterval);
    }

    showError(message) {
        this.dom.statusText.innerText = message;
    }

    updateLiveStation(station, distance) {
        if (!station) return;
        
        this.dom.stationName.innerText = station.name;
        this.dom.stationName.classList.add('loaded');
        
        this.dom.bikesCount.innerText = station.available_bikes;
        this.dom.standsCount.innerText = station.available_bike_stands;

        if (distance >= 1000) {
            this.dom.distanceDisplay.innerText = (distance / 1000).toFixed(1) + 'km';
        } else {
            this.dom.distanceDisplay.innerText = Math.round(distance) + 'm';
        }

        this.dom.statusText.innerText = 'Pointing to nearest station';
    }

    updateCompass(rotation) {
        this.dom.needle.style.transform = `rotate(${rotation}deg)`;
    }
}
