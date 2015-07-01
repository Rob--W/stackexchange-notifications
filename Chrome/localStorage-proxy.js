/* globals Storage, chrome */
/*
 * Replace the global localStorage object with a fake localStorage implementation
 * that is backed by chrome.storage.sync
 *
 * Note: This wrapper is just an easy hack to transition to the async
 * chrome.storage.sync without having to restructure the code that uses
 * the synchronous localStorage.
 *
 * The global "HackyLocalStorageReady" event is dispatched when the fake
 * localStorage is available (typically within a few milliseconds).
 * If you use localStorage BEFORE it is ready, then a TypeError will be thrown.
 */
(function() {
    'use strict';
    // Uninitialized. Using "localStorage" before initialization is an error.
    var storage;

    (function() {
        // Migrate from previous version of the add-on, that used the real
        // localStorage object to persist preferences.
        var localStorageKeyCount = localStorage.length;
        storage = {};
        for (var i = localStorageKeyCount; i > 0; --i) {
            var key = localStorage.key(0);
            if (!storage.hasOwnProperty(key)) {
                storage[key] = localStorage.getItem(key);
            }
            localStorage.removeItem(key);
        }
        if (localStorageKeyCount > 0) {
            synchronize();
        }
    })();

    // Replace the storage methods with a custom version that delegates the actual storage
    // to the main page
    Storage.prototype.setItem = setItem;
    Storage.prototype.getItem = getItem;
    Storage.prototype.removeItem = removeItem;
    function setItem(key, value) {
        value += ''; // Coerce to string for consistency with localStorage
        storage[key] = value;
        synchronize();
    }
    function getItem(key) {
        return storage.hasOwnProperty(key) ? storage[key] : null;
    }
    function removeItem(key) {
        delete storage[key];
        synchronize();
    }
    function synchronize() {
        chrome.storage.sync.set({
            localStorageData: storage
        });
    }
    chrome.storage.sync.get({
        localStorageData: {}
    }, function(items) {
        storage = items.localStorageData || {};
        // Notify users that the storage is ready.
        window.dispatchEvent(new CustomEvent('HackyLocalStorageReady'));
    });

    chrome.storage.onChanged.addListener(function(changes) {
        if (changes.localStorageData) {
            storage = changes.localStorageData.newValue || {};
        }
    });
})();
