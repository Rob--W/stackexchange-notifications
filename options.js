var bg = chrome.extension.getBackgroundPage();
bg.optionsOpened = true;
var uid = document.getElementById('uid');
var link = document.getElementById('link');
var save = document.getElementById('save');

var statusSpan = document.getElementById('status');
var socketStart = document.getElementById('socket-start');
var socketStop = document.getElementById('socket-stop');

var incognito = document.getElementById('incognito');

uid.value = bg.getUserID() || '';
link.value = bg.getLink();
document.getElementById('default-link').textContent = bg.generateDefaultLink('<uid>');
incognito.checked = !!localStorage.getItem('incognito');
incognito.onchange = function() {
    localStorage.setItem('incognito', this.checked ? '1' : '');
};

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
uid.ondown = link.onkeydown = function(ev) {
    if (ev.which == 13) saveFields();
};
socketStart.onclick = function() {
    bg.startSocket();
};
socketStop.onclick = function() {
    bg.stopSocket(true);
};

function _uidChange(value) {
    if (value != uid.value) uid.value = value;
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
