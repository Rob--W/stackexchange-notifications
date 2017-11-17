window.localStoragePromise.then(function() {
    // When an extension is enabled from about:addons in Firefox,
    // the options page is initialized before the background page.
    return chrome.extension.getBackgroundPage().localStoragePromise;
}).then(function() {

var bg = chrome.extension.getBackgroundPage();
var incognito = document.getElementById('incognito');
var autostart = document.getElementById('autostart');
var run_in_bg = document.getElementById('run_in_bg');
var persist_notification = document.getElementById('persist_notification');

document.getElementById('default-link').textContent = bg.generateDefaultLink('<uid>');

// Open tabs in incognito window? 
incognito.checked = !!localStorage.getItem('incognito');
incognito.onchange = function() {
    localStorage.setItem('incognito', this.checked ? '1' : '');
};
// When no preference is set, set autostart to true
autostart.checked = localStorage.getItem('autostart') != '0';
autostart.onchange = function() {
    localStorage.setItem('autostart', this.checked ? '1' : '0');
};

// Continue running when Chrome is closed?
var _chromePermissions = {
    permissions: ['background']
};
function setPermissionCheckbox(state) {
    run_in_bg.checked = state;
}
try {
    chrome.permissions.contains(_chromePermissions, setPermissionCheckbox);
} catch (e) {
    // Firefox does not support "background" permission.
    run_in_bg.parentNode.remove();
}
run_in_bg.onchange = function() {
    if (this.checked) {
        chrome.permissions.request(_chromePermissions, setPermissionCheckbox);
    } else {
        chrome.permissions.remove(_chromePermissions, function(result) { setPermissionCheckbox(!result); });
    }
};

// Persist Chrome notifications?
persist_notification.checked = !!localStorage.getItem('persist_notification');
persist_notification.onchange = function() {
    localStorage.setItem('persist_notification', this.checked ? '1' : '');
};

// requireInteraction is supported since 50.0.2638.0, disable the checkbox if unsupported.
try {
    chrome.notifications.update('', {requireInteraction: false});
} catch (e) {
    persist_notification.disabled = true;
    persist_notification.insertAdjacentText('afterend', ' [requires Chrome 50+]');
    if (typeof browser === 'object') {
        // Firefox does not support requireInteraction - https://bugzil.la/1417848
        persist_notification.parentNode.remove();
    }
}

if (!chrome.permissions || !chrome.permissions.onRemoved) return; // Not supported by Firefox.

// Currently, there's only one optional permission. Don't check whether the added/removed permission is "background"
chrome.permissions.onRemoved.addListener(function(permissions) {
    setPermissionCheckbox(false);
});
chrome.permissions.onAdded.addListener(function(permissions) {
    setPermissionCheckbox(true);
});

});
