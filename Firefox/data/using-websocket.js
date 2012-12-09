(function(exports) {

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
function console_log(message_string) {
    postMessage('#' + message_string, '*');
}

// Open options page, make sure that only one is opened
function ensureOneOptionsPage() {
    postMessage(JSON.stringify({
        method: 'showOptions'
    }), '*');
}

var _attempts = 0;
function getReconnectDelay() {
    // Exponential growth till 2^9, followed by linear growth
    return 1e3 * ( ++_attempts < 10 ? Math.pow(2, _attempts) : 100 * _attempts);
}
function resetAttempts() {
    _attempts = 0;
}

var ws;
var socket_keep_alive = false;
function startSocket() {
    stopSocket();
    if (ws) return;

    var uid = getUserID();
    if (!uid) {
        console_log('Did not start socket because no UID is found');
        // In Chrome, a confirmation dialog is shown. In Firefox, no confirmation is shown, because the options panel is less intrusive
        postMessage(JSON.stringify({
            method: 'showOptions'
        }), '*');
        return;
    }

    // Socket, don't die!
    socket_keep_alive = true;

    var method = uid + '-inbox';
    var WebSocketConstructor = typeof WebSocket == 'undefined' ? MozWebSocket : WebSocket;
    ws = new WebSocketConstructor(SOCKET_URL);
    ws.onopen = function() {
        console_log('Opened WebSocket and subscribed to method ' + method);
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
        console_log('Closed WebSocket');
        ws = null;
        if (socket_keep_alive) setTimeout(startSocket, getReconnectDelay());

        eventEmitter.emit('socket', 'close');
    };
    ws.onerror = function() {
        console_log('WebSocket failed');
        ws = null;
    };
}
function getSocketStatus() {
    return ws ? ws.readyState : 0;
}
function stopSocket(explicitStop) {
    if (explicitStop) socket_keep_alive = false;
    if (ws) try {
        console_log('Closing (existing) WebSocket');
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
function showNotification() {
    var unreadCount = getUnreadCount();
    if (unreadCount > 0) {
        postMessage(JSON.stringify({
            method: 'showNotification',
            data: {
                unreadCount: unreadCount,
                link: getLink() || generateDefaultLink()
            }
        }), '*');
    }
}

// When the UID changes, restart socket (socket will be closed if UID is empty)
eventEmitter.on('change:uid', function(id) {
    if (localStorage.getItem('autostart') != '0') startSocket();
});
// Start socket with default settings if possible
if (localStorage.getItem('autostart') != '0') startSocket();

exports.background = {
    eventEmitter: eventEmitter, // .emit(method. data) .on(method, callback) off(method[, callback])
    ensureOneOptionsPage: ensureOneOptionsPage,
    getReconnectDelay: getReconnectDelay,
    resetAttempts: resetAttempts,
    startSocket: startSocket,
    getSocketStatus: getSocketStatus,
    stopSocket: stopSocket, // args: boolean explicitStop
    getUserID: getUserID,
    setUserID: setUserID, // args: string id
    getLink: getLink,
    generateDefaultLink: generateDefaultLink, // args: string uid default getUserID()
    setLink: setLink, // args: string link
    setUnreadCount: setUnreadCount, // args: count
    getUnreadCount: getUnreadCount,
    showNotification: showNotification
};

})(typeof exports == 'undefined' ? this : exports);