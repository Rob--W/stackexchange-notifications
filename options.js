var bg = chrome.extension.getBackgroundPage();
bg.ensureOneOptionsPage();
var uid = document.getElementById('uid');
var link = document.getElementById('link');
var save = document.getElementById('save');

var statusSpan = document.getElementById('status');
var socketStart = document.getElementById('socket-start');
var socketStop = document.getElementById('socket-stop');

var incognito = document.getElementById('incognito');
var autostart = document.getElementById('autostart');
var run_in_bg = document.getElementById('run_in_bg');

uid.value = bg.getUserID() || '';
link.value = bg.getLink();
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
// Currently, there's only one optional permission. Don't check whether the added/removed permission is "background"
chrome.permissions.onRemoved.addListener(function(permissions) {
    setPermissionCheckbox(false);
});
chrome.permissions.onAdded.addListener(function(permissions) {
    setPermissionCheckbox(true);
});


// Save uid and link settings
var saveFields = save.onclick = function() {
    bg.setUserID(uid.value);
    bg.setLink(link.value);
    uid.classList.remove('changed');
    link.classList.remove('changed');
};
uid.oninput =
link.oninput = function(ev) {
    if (this.value != this.defaultValue) {
        this.classList.add('changed');
    } else {
        this.classList.remove('changed');
    }
};
uid.onkeydown = link.onkeydown = function(ev) {
    if (ev.which == 13) saveFields();
};

// Start/stop socket feature
socketStart.onclick = function() {
    bg.startSocket();
};
socketStop.onclick = function() {
    bg.stopSocket(true);
};

// Event emitter event listeners
function _uidChange(value) {
    if (value != uid.value) uid.value = value;
    // If socket has been started, then disable button
    socketStart.disabled = bg.getSocketStatus() == 1;
}
function _linkChange(value) {
    if (value != link.value) link.value = value;
}

function socketEventListener(status) {
    if (status == 'open') {
        statusSpan.textContent = 'listening';
        socketStart.disabled = true;
        socketStop.disabled = false;
    } else if (status == 'close') {
        statusSpan.textContent = 'stopped';
        // Only show if uid is defined
        socketStart.disabled = !bg.getUserID();
        socketStop.disabled = true;
    }
}
// Handle current status
socketEventListener(bg.getSocketStatus() == 1 ? 'open' : 'close');

// Bind events
bg.eventEmitter.on('socket', socketEventListener);
bg.eventEmitter.on('change:uid', _uidChange);
bg.eventEmitter.on('change:link', _linkChange);
addEventListener('unload', function() {
    bg.eventEmitter.off('socket', socketEventListener);
    bg.eventEmitter.off('change:uid', _uidChange);
    bg.eventEmitter.off('change:link', _linkChange);
    bg.optionsOpened = false;
});
