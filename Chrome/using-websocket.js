/* globals chrome, StackExchangeInbox */
// Highly specific piece of code for subscribing to inbox notifications
var METHOD; // UID + '-inbox';

// Maintain WebSocket connection
var SOCKET_URL = 'wss://qa.sockets.stackexchange.com';

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
    var options_url = chrome.runtime.getURL('options.html');
    if (chrome.runtime.openOptionsPage) {
        var views = chrome.extension.getViews() || [];
        if (views.some(function(view) {
            try {
                return view.location.href.startsWith(options_url);
            } catch (e) {
                return false;
            }
        })) {
            chrome.runtime.openOptionsPage();
            return;
        }
    }
    chrome.tabs.query({
        url: options_url
    }, function(tabs) {
        if (tabs.length == 0) {
            if (chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage();
                return;
            }
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
var delayedSocketStarter;  // Timer to start the socket
// Refresh socket when we're online again, to make sure that the backend sends messages to us
addEventListener('online', function() {
    if (socket_keep_alive) {
        console.log('Refreshing connection after receiving "online" event.');
        restartSocket();
    }
});
function startSocket() {
    stopSocket();
    if (ws) return;

    var uid = getUserID();
    if (!uid) {
        console.log('Did not start socket because no UID is found');
        chrome.tabs.query({
            url: chrome.runtime.getURL('options.html'),
            active: true
        }, function(tabs) {
            if (tabs.length) return;
            if (chrome.notifications) {
                chromeNotificationsCreate(CONFIG_NOTIFICATION_ID, {
                    type: 'basic',
                    iconUrl: chrome.runtime.getURL('icon.png'),
                    title: 'Configuration required for Stack Exchange notifications',
                    message: 'No user ID found. Click here to configure Desktop Notifications for Stack Exchange.'
                });
                return;
            }
            if (confirm('No user ID found. Want to configure Desktop Notifications for the Stack Exchange?')) {
                ensureOneOptionsPage();
            }
        });
        return;
    }

    // Socket, don't die!
    socket_keep_alive = true;
    var lastHeartbeat; // Used to check whether or not the connection died

    var method = uid + '-topbar';
    ws = new WebSocket(SOCKET_URL);
    ws.onopen = function() {
        console.log('Opened WebSocket and subscribed to method ' + method);
        resetAttempts();
        // Get initial counts
        StackExchangeInbox.fetchUnreadCount();
        // Subscribe to inbox
        this.send(method);
        
        // Watch connectivity
        lastHeartbeat = Date.now();
        this._socketWatcher = setInterval(function() {
            var diff = Math.round((Date.now() - lastHeartbeat) / 60 / 1000);
            if (diff > 6) {
                console.log('Last heartbeat was ' + diff + ' seconds ago. Resetting socket...');
                // Reset socket when the socket died (heartbeat should occur every 5 minutes)
                restartSocket();
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
        if (message.action == method) {
            if (typeof message.data == 'string') {
                // The data appears to be JSON-encoded twice. So unpack it again.
                message.data = JSON.parse(message.data);
            }
            if (message.data && message.data.Inbox) {
                setUnreadCount(message.data.Inbox.UnreadInboxCount);
            }
        }

        eventEmitter.emit('socket', 'message');
    };
    ws.onclose = function() {
        console.log('Closed WebSocket');
        restartSocket();
    };
    ws.onerror = function() {
        console.log('WebSocket failed');
        restartSocket();
    };
}
function getSocketStatus() {
    return ws ? ws.readyState : 0;
}
function stopSocket(explicitStop) {
    if (explicitStop) socket_keep_alive = false;
    clearTimeout(delayedSocketStarter);
    if (!ws) {
        return;
    }
    try {
        ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
        clearInterval(ws._socketWatcher);
        if (ws.readyState !== 2 && ws.readyState !== 3) { // Not closed yet.
            console.log('Closing (existing) WebSocket');
            ws.close();
        }
    } catch(e) {}
    ws = null;
    eventEmitter.emit('socket', 'close');
}

function restartSocket() {
    if (!socket_keep_alive) return;
    stopSocket(); // Will automatically reconnect because socket_keep_alive is true;
    delayedSocketStarter = setTimeout(startSocket, getReconnectDelay());
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
    return 'https://stackexchange.com/users/' + (uid || getUserID()) + '/?tab=inbox';
}
function setLink(link) {
    var previousLink = getLink();
    localStorage.setItem('open-on-click', link);
    if (previousLink != link) eventEmitter.emit('change:link', link);
}


// Get count
var _unreadCount = 0;
function setUnreadCount(count) {
    _unreadCount = +count;
    eventEmitter.emit('change:unread', _unreadCount);
}
function getUnreadCount() {
    return _unreadCount;
}

// Notification
var _notification, _currentNotificationID;
var CHROME_NOTIFICATION_ID = 'se-notifications';
var CONFIG_NOTIFICATION_ID = 'CONFIG_PROMPT';
var chromeNotificationSupportsClick = true;
var chromeNotificationSupportsPersistence = true;
if (chrome.notifications) {
    chrome.notifications.onClicked.addListener(function(notificationId) {
        if (notificationId === CHROME_NOTIFICATION_ID) {
            openTab(getLink() || generateDefaultLink());
            chrome.notifications.clear(notificationId, function() {});
        }
        if (notificationId === CONFIG_NOTIFICATION_ID) {
            ensureOneOptionsPage();
            chrome.notifications.clear(notificationId, function() {});
        }
    });

    try {
        chrome.notifications.update('', {requireInteraction: false}, function() {});
    } catch (e) {
        // This feature shipped in Chrome 50.0.2638.0 (https://crbug.com/574763)
        chromeNotificationSupportsPersistence = false;
    }

    try {
        chrome.notifications.update('', {isClickable: false}, function() {});
    } catch (e) {
        // This feature was added in 32.0.1676.0 (http://crbug.com/304923)
        chromeNotificationSupportsClick = false;
    }
}

function chromeNotificationsCreate(notificationId, notificationOptions) {
    if (chromeNotificationSupportsClick) {
        notificationOptions.isClickable = true;
    }
    if (chromeNotificationSupportsPersistence) {
        notificationOptions.requireInteraction = localStorage.getItem('persist_notification') !== '';
    }
    chrome.notifications.create(notificationId, notificationOptions, function() {});
}

function showNotification() {
    var notID = _currentNotificationID = new Date().getTime();
    if (_notification) _notification.cancel();
    else if (chrome.notifications) chrome.notifications.clear(CHROME_NOTIFICATION_ID, function() {});
    if (getUnreadCount() > 0) {
        var iconURL = chrome.runtime.getURL('icon.png');
        var head = getUnreadCount() + ' unread messages in your inbox';
        var body = '';
        if (!window.webkitNotifications) {
            var notificationOptions = {
                type: 'basic',
                iconUrl: iconURL,
                title: head,
                message: body
            };
            chromeNotificationsCreate(CHROME_NOTIFICATION_ID, notificationOptions);
            return;
        }
        _notification = webkitNotifications.createNotification(iconURL, head, body);
        _notification.onclose = function() {
            if (_currentNotificationID == notID) {
                _notification = null;
            }
        };
        _notification.onclick = function() {
            openTab(getLink() || generateDefaultLink());
            _notification.cancel();
        };
        _notification.show();
    }
}
function updateBageText() {
    chrome.browserAction.setBadgeText({
        text: String(getUnreadCount() || ''),
    });
}

// When the UID changes, restart socket (socket will be closed if UID is empty)
eventEmitter.on('change:uid', function(id) {
    if (localStorage.getItem('autostart') != '0') startSocket();
});
// When unread count is set, show a notification
eventEmitter.on('change:unread', function() {
    if (localStorage.getItem('use_desktop_notifications') != '0') showNotification();
});
eventEmitter.on('change:unread', updateBageText);
StackExchangeInbox.on('change:unread', setUnreadCount);
StackExchangeInbox.on('error', function(error_message) {
    console.log(error_message);
});
StackExchangeInbox.on('found:account_id', function(account_id) {
    setUserID(account_id);
});

window.localStoragePromise.then(function() {
    // Start socket with default settings if possible
    if (localStorage.getItem('autostart') != '0') startSocket();
});
