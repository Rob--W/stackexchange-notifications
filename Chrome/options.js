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

uid.defaultValue = uid.value = bg.getUserID() || '';
link.defaultValue = link.value = bg.getLink();
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

// UID change & name lookup
var _api_xhr;
var _currentlyCheckingUID = -1;
var _l1_cache = {}
var _l2_cache = {};
var _timedoutRequest;
uid.oninput = function() {
    clearTimeout(_timedoutRequest);
    // Change the appearance only if the uid really changed
    var val = +/\d*/.exec(this.value)[0];
    if (val != /\d*/.exec(this.defaultValue)[0]) {
        this.classList.add('changed');
    } else {
        this.classList.remove('changed');
    }
    document.getElementById('display-name').textContent = '';
    if (val > 0) {
        if (_l1_cache[val]) {
            // Already cached, try to get the value
            siteuidToName(_l1_cache[val]);
        } else {
            _timedoutRequest = setTimeout(uidToName, 300, val);
        }
    }
};
// Given a UID, a name is fetched using the Stack Exchange API
function uidToName(val) {
    val = +val;
    if (!(val > 0)) return;
    if (_l1_cache[val]) {
        return siteuidToName(_l1_cache[val]);
    }
    if (_currentlyCheckingUID == val) return;
    
    // No concurrent requests
    if (_api_xhr) try {
        var tmp = _api_xhr;
        _api_xhr = null;
        tmp.abort();
    }catch(e){}

    _api_xhr = new XMLHttpRequest();
    _api_xhr.onload = function() {
        if (this === _api_xhr) _api_xhr = null;
        var result = JSON.parse(this.responseText);
        if (result = result.items && result.items[0]) {
            _l1_cache[val] = result;
            siteuidToName(result);
        } else {
            _l1_cache[val] = {};
            document.getElementById('display-name').textContent = 'N/A';
        }
    };
    _api_xhr.onabort =
    _api_xhr.onerror = function() {
        if (this === _api_xhr) {
            _api_xhr = null;
            document.getElementById('display-name').textContent = '<error 1>';
        }
    };
    _api_xhr.open('GET', 'http://api.stackexchange.com/2.1/users/' + val + '/associated?pagesize=1&filter=!T*uyp79PvoVzKR.KV1');
    _currentlyCheckingUID = val;
    document.getElementById('display-name').innerHTML = '<img src="data:image/gif;base64,' +
        'R0lGODlhEgAEAKEAAH9/fwAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQJDwACACwAAAAAEgAE' +
        'AAACB5SPqcvtrwoAIfkECQ8AAgAsAAAAAAQABAAAAgSEjwkFACH5BAkPAAIALAAAAAALAAQAAAIMjCMJ' +
        'C4fKXBKsnVkLACH5BAkPAAIALAAAAAASAAQAAAIRjCN5mOCwkojt0Xnkg1l1sRUAIfkECQ8AAgAsAAAA' +
        'ABIABAAAAhGEIRkbKRwOUsxBaStdeDdfAAAh+QQJDwACACwHAAAACwAEAAACDIQhGRuHylwSrJ1ZCwAh' +
        '+QQFDwACACwOAAAABAAEAAACBISPCQUAOw==">';
    _api_xhr.send();
}
// Intended to only be called by uidToName.
function siteuidToName(result) {
    var site = result.site_url;
    if (site) site = site.split('//').pop();
    var siteuid = result.user_id;
    if (!site) {
        return document.getElementById('display-name').textContent = 'N/A';
    }
    if (_l2_cache[site + siteuid]) {
        return document.getElementById('display-name').textContent = _l2_cache[site + siteuid];
    }
    
    // No concurrent requests
    if (_api_xhr) try {
        var tmp = _api_xhr;
        _api_xhr = null;
        tmp.abort();
    }catch(e){}

    _api_xhr = new XMLHttpRequest();
    _api_xhr.onload = function() {
        if (this === _api_xhr) _api_xhr = null;
        var result = JSON.parse(this.responseText);
        result = result.items && result.items[0] ? result.items[0].display_name || '(empty)' : 'N/A';
        _l2_cache[site + siteuid] = result;
        document.getElementById('display-name').textContent = result;
    };
    _api_xhr.onabort =
    _api_xhr.onerror = function() {
        if (this === _api_xhr) {
            _api_xhr = null;
            document.getElementById('display-name').textContent = '<error 2>';
        }
    };
    _api_xhr.open('GET', 'http://api.stackexchange.com/2.1/users/' + siteuid + '?site=' + site + '&filter=!)RwZ73MVf)pA)F7A2gmXoGZm');
    _api_xhr.send();
}

// Start/stop socket feature
socketStart.onclick = function() {
    bg.startSocket();
};
socketStop.onclick = function() {
    bg.stopSocket(true);
};

// Event emitter event listeners
function _uidChange(value) {
    if (value != uid.value) {
        uid.defaultValue = uid.value = value;
        uidToName(value);
    }
    // If socket has been started, then disable button
    socketStart.disabled = bg.getSocketStatus() == 1;
}
function _linkChange(value) {
    if (value != link.value) link.defaultValue = link.value = value;
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
});

// Extremely low priority, so put it here:
// (this inserts the name corresponding to the user id after the #uid field))
uidToName(bg.getUserID());
