window.addEventListener('HackyLocalStorageReady', function() {

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
chrome.permissions.contains(_chromePermissions, setPermissionCheckbox);
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

// Currently, there's only one optional permission. Don't check whether the added/removed permission is "background"
chrome.permissions.onRemoved.addListener(function(permissions) {
    setPermissionCheckbox(false);
});
chrome.permissions.onAdded.addListener(function(permissions) {
    setPermissionCheckbox(true);
});

}); // End of addEventListener('HackyLocalStorageReady'
