/* globals Storage */
/*
 * Replace the global localStorage object with 
 */
(function() {
    'use strict';
    var storage = JSON.parse(document.documentElement.getAttribute('localStorageData')) || {};
    document.documentElement.removeAttribute('localStorageData');

    (function() {
        // Migrate from previous version of the add-on, that used the real
        // localStorage object to persist preferences.
        for (var i = localStorage.length; i > 0; --i) {
            var key = localStorage.key(0);
            if (!storage.hasOwnProperty(key)) {
                storage[key] = localStorage.getItem(key);
            }
            localStorage.removeItem(key);
        }
    })();

    // Replace the storage methods with a custom version that delegates the actual storage
    // to the main page
    Storage.prototype.setItem = setItem;
    Storage.prototype.getItem = getItem;
    Storage.prototype.removeItem = removeItem;
    function setItem(key, value) {
        value += ''; // Coerce to string
        storage[key] = value;
        synchronize('setItem', key, value);
    }
    function getItem(key) {
        return storage.hasOwnProperty(key) ? storage[key] : null;
    }
    function removeItem(key) {
        delete storage[key];
        synchronize('removeItem', key);
    }
    function synchronize(type, key, value) {
        document.dispatchEvent(new CustomEvent('localStorageChange', {
            detail: {
                type: type,
                key: key,
                value: value
            }
        }));
    }
})();
