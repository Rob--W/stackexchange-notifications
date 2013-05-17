/**
 * This is the Firefox port of "Desktop Notifications for Stack Exchange"
 * StackApps listing: http://stackapps.com/q/3780/9699
 * CWS: https://chrome.google.com/webstore/detail/desktop-notifications-for/ijglncoabcgieiokjmgdogpefdblmnle
 * 
 * In the Chrome extension, all significant logic happened in the background page.
 * Unlike Chrome, Firefox's "background script" does not support the same APIs as in a web page.
 * Therefore, the "background logic" is split between main.js and a supporting widget.
 * 
 * The Chrome extension's using-websocket.js is used in the widget, with the following changes:
 * - The `eventEmitter` object is removed. All `eventEmitter` references were replaced by `self.port.emit('eventEmitter', ...)` / `self.port.on('eventEmitter', ...)`.
 * - When logic is migrated away from a function. it's put in main.js, and called isong an event emitter. The event's name is prefixed with the function's name, a colon, followed by a short description.
 */
/* jshint moz:true */
var {data} = require('self');
var notifications = require('notifications');
var windows = require('windows');
var {browserWindows} = windows;
var tabs = require('tabs');

var optionsPanel = require('panel').Panel({
    width: 600,
    height: 300,
    contentURL: data.url('options.html'),
    contentScriptFile: data.url('bridge.js'),
    contentScriptWhen: 'start'
});
// Handle page -> content script -> main.js message
optionsPanel.port.on('options_message', function(message) {
    message = JSON.parse(message);
    switch (message.method) {
        case 'showOptions':
            if (!optionsPanel.isShowing) {
                optionsPanel.show();
            }
        break;
        case 'showNotification':
            var matchesURL = function(url) {
                return message.data.link.indexOf(url) === 0;
            };
            notifications.notify({
                title: 'StackExchange\'s inbox',
                text: message.data.unreadCount + ' unread messages in your inbox',
                data: message.data.link,
                onClick: function(link) {
                    // Activate existing tab in active window
                    for each (let tab in browserWindows.activeWindow.tabs) {
                        if (matchesURL(tab.url)) {
                            console.log('Activating existing tab in active window');
                            tab.activate();
                            browserWindows.activeWindow.activate();
                            return;
                        }
                    }
                    // Active existing tab in any window
                    for each (let window in browserWindows) {
                        for each (let tab in window.tabs) {
                            if (matchesURL(tab.url)) {
                                console.log('Activating existing tab');
                                tab.activate();
                                window.activate();
                                return;
                            }
                        }
                    }
                    // At this point, the URL is unknown
                    console.log('Opening new tab');
                    tabs.open({
                        url: link,
                        onOpen: function(tab) {
                            console.log('Activating window');
                            browserWindows.activeWindow.activate();
                        }
                    });
                }
            });
        break;
    }
});

// The icon (widget) which is responsible for creating and maintaining a socket connection
var icon = require('widget').Widget({
    id: 'widget-desktop-notifications-se',
    label: 'Real-time desktop notifications for Stack Exchange\'s inbox',
    contentURL: data.url('icon.png'),
    panel: optionsPanel
});
exports.optionsPanel = optionsPanel;

require('page-mod').PageMod({
    // The following URL contains the addition of "robw", which ought to make the URL sufficiently unique to avoid conflicts with others
    include: 'https://stackexchange.com/oauth/login_success?robw&*',
    contentScriptFile: data.url('login_success.js'),
    contentScriptWhen: 'end',
    onAttach: function(worker) {
        // Example of hash: #access_token=ZxqGlCmJzvrr99D(9dcEwA))&state=3&expires=86400
        worker.port.on('message', function(message) {
            optionsPanel.port.emit('to_options_message', message);
            // `worker.tab.on('close')` is unreliable, so use this instead..:
            require('timers').setTimeout(function() {
                if (!optionsPanel.isShowing) {
                    optionsPanel.show();
                }
            }, 300);
        });
    }
});
