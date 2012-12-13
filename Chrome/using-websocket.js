/*global */
// Highly specific piece of code for subscribing to inbox notifications
var METHOD; // UID + '-inbox';

// Maintain WebSocket connection
var SOCKET_URL = 'ws://sockets-se.or.stackexchange.com';

// Very simple event emitter
var eventEmitter = {
    _callbacks: {},
    emit: function(method, data) {
        var callbacks = this._callbacks[method] || [];
        for (var i=0; i<callbacks.length; i++) {
            callbacks[i](data);
        }
    },
    on: function(method, callback) {
        if (typeof callback != "function") throw "Callback must be a function!";
        (this._callbacks[method] || (this._callbacks[method] = [])).push(callback);
    },
    off: function(method, callback) {
        if (!callback) delete this._callbacks[method];
        else if (this._callbacks[method]) {
            var index = this._callbacks[method].indexOf(callback);
            if (index !== -1) this._callbacks[method].splice(index, 1);
        }
    }
};

function openTab(url) {
    var incognitoPreference = !!localStorage.getItem('incognito');
    chrome.windows.getAll(function(windows) {
        // No windows. Just create a new one
        if (windows.length == 0) return createWindow();
        // Use currently focused window if incognito flag matches
        for (var i=0; i<windows.length; i++)
            if (windows[i].focused == true)
                if (windows[i].incognito == incognitoPreference)
                    return createTab(windows[i].id);
        // Use any window which matches the incognito flag
        for (var i=0; i<windows.length; i++)
            if (windows[i].incognito == incognitoPreference)
                return createTab(windows[i].id);
        // No suitable window found, create new one
        createWindow();
    });
    function createWindow() {
        chrome.windows.create({
            focused: true,
            incognito: incognitoPreference,
            url: url
        });
    }
    function createTab(windowId) {
        chrome.tabs.create({
            windowId: windowId,
            url: url,
            active: true
        }, function(tab) {
            chrome.windows.update(tab.windowId, {
                focused: true
            });
        });
    }
}
// Open options page, make sure that only one is opened
function ensureOneOptionsPage() {
    var options_url = chrome.extension.getURL('options.html');
    chrome.tabs.query({
        url: options_url
    }, function(tabs) {
        if (tabs.length == 0) {
            openTab(options_url);
        } else {
            // If there's more than one, close all but the first
            for (var i=1; i<tabs.length; i++)
                chrome.tabs.remove(tabs[i].id);
            // And focus the options page
            chrome.tabs.update(tabs[0].id, {active: true});
        }
    });
}

var _attempts = 0;
function getReconnectDelay() {
    // Exponential growth till 2^9, followed by fixed interval of 10 minutes.
    return 1e3 * ( ++_attempts < 10 ? Math.pow(2, _attempts) : 600);
}
function resetAttempts() {
    _attempts = 0;
}

var ws;
var socket_keep_alive = false;
// Refresh socket when we're online again, to make sure that the backend sends messages to us
addEventListener('online', function() {
    if (socket_keep_alive) {
        console.log('Refreshing connection after receiving "online" event.');
        stopSocket(); // Will automatically reconnect because socket_keep_alive is true;
    }
});
function startSocket() {
    stopSocket();
    if (ws) return;

    var uid = getUserID();
    if (!uid) {
        console.log('Did not start socket because no UID is found');
        chrome.tabs.query({
            url: chrome.extension.getURL('options.html'),
            active: true
        }, function(tabs) {
            if (!tabs.length && confirm('No user ID found. Want to configure Desktop Notifications for the Stack Exchange?')) {
                ensureOneOptionsPage();
            }
        });
        return;
    }

    // Socket, don't die!
    socket_keep_alive = true;

    var method = uid + '-inbox';
    ws = new WebSocket(SOCKET_URL);
    ws.onopen = function() {
        console.log('Opened WebSocket and subscribed to method ' + method);
        resetAttempts();
        // Get initial counts
        // TODO: fetchInboxUnviewCount();
        // Subscribe to inbox
        this.send(method);
        
        // Watch connectivity
        lastHeartbeat = Date.now();
        socketWatcher = setInterval(function() {
            var diff = Math.round((Date.now() - lastHeartbeat) / 60 / 1000);
            if (diff > 6) {
                console.log('Last heartbeat was ' + diff + ' seconds ago. Resetting socket...');
                // Reset socket when the socket died (heartbeat should occur every 5 minutes)
                stopSocket();
                // stopSocket -> onclose -> clearInterval(socketWatcher)
                // After stopping, the socket will automatically be recreated because
                // `socket_keep_alive` is still true
            }
        }, 5000); // Small delay, because getting a timestamp and calculating the diff is inexpensive

        eventEmitter.emit('socket', 'open');
    };
    ws.onmessage = function(ev) {
        var message = JSON.parse(ev.data);
        if (message.action == 'hb') {
            ws.send(message.data);
            lastHeartbeat = Date.now();
        }
        if (message.action == method) setUnreadCount(message.data);

        eventEmitter.emit('socket', 'message');
    };
    ws.onclose = function() {
        console.log('Closed WebSocket');
        ws = null;
        clearInterval(socketWatcher);
        if (socket_keep_alive) setTimeout(startSocket, getReconnectDelay());

        eventEmitter.emit('socket', 'close');
    };
    ws.onerror = function() {
        console.log('WebSocket failed');
        ws = null;
    };
}
function getSocketStatus() {
    return ws ? ws.readyState : 0;
}
function stopSocket(explicitStop) {
    if (explicitStop) socket_keep_alive = false;
    if (ws) try {
        console.log('Closing (existing) WebSocket');
        ws.close();
    } catch(e) {}
}

// Stack Exchange User ID
function getUserID() {
    return localStorage.getItem('stackexchange-user-id');
}
function setUserID(id) {
    id = /\d*/.exec(id)[0];
    var previousID = getUserID();
    localStorage.setItem('stackexchange-user-id', id);
    if (id != previousID) eventEmitter.emit('change:uid', id);
}


// Link on click
function getLink() {
    return localStorage.getItem('open-on-click');
}
function generateDefaultLink(uid) {
    return 'http://stackexchange.com/users/' + (uid || getUserID()) + '/?tab=inbox';
}
function setLink(link) {
    var previousLink = getLink();
    localStorage.setItem('open-on-click', link);
    if (previousLink != link) eventEmitter.emit('change:link', link);
}


// Get count
var _unreadCount = 0;
function setUnreadCount(count) {
    _unreadCount = count;
    showNotification();
}
function getUnreadCount() {
    return _unreadCount;
}

// Notification
var _notification, _currentNotificationID;
function showNotification() {
    var notID = new Date().getTime();
    if (_notification) _notification.close();
    if (getUnreadCount() > 0) {
        _notification = webkitNotifications.createHTMLNotification(chrome.extension.getURL('notification.html'));
        _notification.onclose = function() {
            if (_currentNotificationID == notID) {
                _notification = null;
            }
        };
        _notification.show();
    }
}

// When the UID changes, restart socket (socket will be closed if UID is empty)
eventEmitter.on('change:uid', function(id) {
    if (localStorage.getItem('autostart') != '0') startSocket();
});
// Start socket with default settings if possible
if (localStorage.getItem('autostart') != '0') startSocket();
