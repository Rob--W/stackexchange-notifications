/**
 * This is the Firefox port of "Desktop Notifications for Stack Exchange"
 * StackApps listing: https://stackapps.com/q/3780/9699
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
/* jshint moz:true, browser:false */
const { data } = require('sdk/self');
const notifications = require('./longlived-notifications');
const windows = require('sdk/windows');
const { browserWindows } = windows;
const tabs = require('sdk/tabs');
const sstorage = require('sdk/simple-storage').storage;
const { setTimeout } = require('sdk/timers');

// Some placeholder username.
const DUMMY_AUTH_USERNAME = 'dummy_auth_username';

if (!sstorage.localStorageData) sstorage.localStorageData = {};

var optionsPanel;
// Read the optional auth token from storage and launch the panel
require('sdk/passwords').search({
    realm: 'stackexchange-notifications',
    url: 'addon:stackexchange-notifications',
    username: DUMMY_AUTH_USERNAME,
    onComplete: function(credentials) {
        var token = credentials[0] && credentials[0].password || '';
        onReady(token);
    }
});


function onReady(token) {
    const PANEL_WIDTH = 600;
    const PANEL_HEIGHT = 300;
    // If the user has already configured the addon:
    // - Start small, to prevent the panel from being noticeable upon startup.
    // - Don't attract focus to the panel to avoid interfering with user input.
    // Otherwise (=new users), show the panel.
    var hasSettings = Object.keys(sstorage.localStorageData).length > 0;
    optionsPanel = require('sdk/panel').Panel({
        width: hasSettings ? 1 : PANEL_WIDTH,
        height: hasSettings ? 1 : PANEL_HEIGHT,
        focus: hasSettings ? false : true,
        contentURL: data.url('options.html'),
        contentScriptFile: data.url('bridge.js'),
        contentScriptWhen: 'start',
        contentScriptOptions: {
            localStorageData: sstorage.localStorageData,
            token: token
        }
    });
    // Store the data in simple-storage, because localStorage may be cleared by accident (#4)
    optionsPanel.port.on('localStorageChange', onStorageChange);
    // Handle page -> content script -> main.js message
    optionsPanel.port.on('options_message', onOptionsMessage);
    if (hasSettings) {
        // Hide the panel as soon as it is visible, and then set the usual dimensions.
        optionsPanel.once('show', function() {
            setTimeout(function() {
                optionsPanel.hide();
                setTimeout(function() {
                    optionsPanel.width = PANEL_WIDTH;
                    optionsPanel.height = PANEL_HEIGHT;
                });
            });
        });
    }
    optionsPanel.show();
    // The panel associated with the widget is responsible for creating and maintaining a socket connection
    let options = {
        id: 'widget-desktop-notifications-se',
        label: 'Real-time desktop notifications for Stack Exchange\'s inbox',
    };
    let ToggleButton;
    try {
        ToggleButton = require('sdk/ui/button/toggle').ToggleButton;
    } catch (e) {}
    if (!ToggleButton) { // backcompat with Firefox < 29
        options.contentURL = data.url('icon.png');
        options.panel = optionsPanel;
        require('sdk/widget').Widget(options);
        return;
    }

    options.icon = data.url('icon.png');
    options.onChange = function(state) {
        if (state.checked) {
            optionsPanel.show({
                focus: true,
                position: button
            });
        }
    };

    optionsPanel.on('hide', function() {
        button.state('window', {
            checked: false
        });
    });
    var button = ToggleButton(options);
}
function onStorageChange(mutation) {
    if (mutation.type === 'setItem') {
        sstorage.localStorageData[mutation.key] = mutation.value;
    } else if (mutation.type === 'removeItem') {
        delete sstorage.localStorageData[mutation.key];
    } else {
        console.log('Unknown mutation: ' + mutation.type + ' for ' + mutation.key);
    }
}
function onOptionsMessage(message) {
    message = JSON.parse(message);
    switch (message.method) {
        case 'showOptions':
            if (!optionsPanel.isShowing) {
                optionsPanel.show({
                    focus: true
                });
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
        case 'hideNotification':
            notifications.close();
        break;
        case 'auth.setToken':
            // There's only a setter, because the stored token is passed to the
            // panel on first run and cached in a local variable.
            // This flow is used to achieve synchronous getToken / setToken
            if (message.token) {
                removeCredentials(function() {
                    require('sdk/passwords').store({
                        realm: 'stackexchange-notifications',
                        url: 'addon:stackexchange-notifications',
                        username: DUMMY_AUTH_USERNAME,
                        password: message.token,
                        onComplete: function() { /* NOOP */ },
                        onError: function() { /* NOOP */ }
                    });
                });
            } else {
                removeCredentials(function() { /* NOOP */ });
            }
        break;
    }
    function removeCredentials(anyCallback) {
        require('sdk/passwords').remove({
            realm: 'stackexchange-notifications',
            url: 'addon:stackexchange-notifications',
            username: DUMMY_AUTH_USERNAME,
            onComplete: anyCallback,
            onError: anyCallback
        });
    }
}


require('sdk/page-mod').PageMod({
    // The following URL contains the addition of "robw", which ought to make the URL sufficiently unique to avoid conflicts with others
    include: 'https://stackexchange.com/oauth/login_success?robw&*',
    contentScriptFile: data.url('login_success.js'),
    contentScriptWhen: 'end',
    onAttach: function(worker) {
        worker.port.on('message', function(message) {
            // message = {auth_token: string, account_id: string}
            optionsPanel.port.emit('to_options_message', message);
            // `worker.tab.on('close')` is unreliable, so use this instead..:
            setTimeout(function() {
                if (!optionsPanel.isShowing) {
                    optionsPanel.show({
                        focus: true
                    });
                }
            }, 300);
        });
    }
});
