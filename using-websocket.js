// Highly specific piece of code for subscribing to inbox notifications
var METHOD; // UID + '-inbox';

// Maintain WebSocket connection
var SOCKET_URL = 'ws://sockets-se.or.stackexchange.com';

var optionsOpened = false;

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

var _attempts = 0;
function getReconnectDelay() {
    // Exponential growth till 2^9, followed by linear growth
    return 1e3 * ( ++_attempts < 10 ? Math.pow(2, _attempts) : 100 * _attempts);
}
function resetAttempts() {
    _attempts = 0;
}

var ws;
function startSocket() {
    stopSocket();
    if (ws) return;

    var uid = getUserID();
    if (!uid) {
        console.log('Did not start socket because no UID is found');
        if (!optionsOpened && confirm('No user ID found. Want to configure Desktop Notifications for the Stack Exchange?')) {
            chrome.tabs.create({
                url: chrome.extension.getURL('options.html'),
                active: true,
                incognito: !!localStorage.getItem('incognito')
            });
        }
        return;
    }

    var method = uid + '-inbox';
    ws = new WebSocket(SOCKET_URL);
    ws.onopen = function() {
        console.log('Opened WebSocket and subscribed to method ' + method);
        resetAttempts();
        // Subscribe to inbox
        this.send(method);

        eventEmitter.emit('socket', 'open');
    };
    ws.onmessage = function(ev) {
        var message = JSON.parse(ev.data);
        if (message.action == 'hb') ws.send(message.data);
        if (message.action == method) setUnreadCount(message.data);

        eventEmitter.emit('socket', 'message');
    };
    ws.onclose = function() {
        console.log('Closed WebSocket');
        ws = null;
        setTimeout(initializeSocketConnection, getReconnectDelay());

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
function stopSocket() {
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
var _notification;
function showNotification() {
    if (_notification) _notification.close();
    if (getUnreadCount() > 0) {
        _notification = webkitNotifications.createHTMLNotification(chrome.extension.getURL('notification.html'));
        _notification.onclose = function() {
            _notification = null;
        };
        _notification.show();
    }
}


// Start socket with default settings if possible
eventEmitter.on('change:id', function(id) {
    init();
});
startSocket();
