# DBCompass - Future Ideas & Roadmap

This document outlines potential features and enhancements for the DBCompass application.

## Core Functionality

*   **Multi-City Support (Global Scaling):** The JCDecaux API provides identical data structures for many other cities globally (e.g., Paris, Brisbane, Seville). Implement a feature to automatically detect the user's city via reverse-geocoding or provide a manual dropdown to switch the `contract` parameter, turning this into a global bike compass.
*   **Pull to Refresh:** Implement a standard pull-to-refresh mechanism to force an immediate API update without needing to reload the entire page. This is especially useful if the user has been walking and wants to check the absolute latest data.
*   **"Open in Dublin Bikes App" Button:** Add a deep link or button that attempts to launch the official Dublin Bikes application (if installed) or redirects to the appropriate app store.
*   **"Navigate to Station" Button:** Add a button that opens the user's default maps application (Google Maps, Apple Maps, etc.) with walking directions pre-populated to the currently selected station's coordinates.

## User Experience (UX)

*   **"Add to Home Screen" Prompt:** Implement a custom prompt or clearer instructions encouraging users to install the web app to their home screen for a more native, fullscreen experience (PWA setup is already partially in place).
*   **Haptic Feedback:** Use the `navigator.vibrate` API to provide subtle physical feedback when the needle "locks" onto a station or when the user is within a very close range (e.g., < 20 meters).
*   **Dynamic Color Coding:** Change the color of the numbers or the needle based on availability (e.g., turn red if bikes/stands drop below 3, green if plenty are available).

## Technical Enhancements

*   **Service Worker / Offline Mode:** Add a Service Worker to cache the core assets (HTML, CSS, JS) so the app loads instantly even with a poor connection, showing the last known state until fresh data arrives.
*   **Error Handling Refinements:** Improve the UI for edge cases, such as when the user is too far outside Dublin (e.g., show a friendly message instead of a massive distance number) or when API limits are reached.
