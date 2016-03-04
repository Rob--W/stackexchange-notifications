/**
 * (c) 2013 - 2015 Rob Wu <rob@robwu.nl> (https://robwu.nl)
 *
 * Long-lived desktop notifications
 * Firefox 22+ implements notifications with XUL, but unfortunately these
 * notifications already disappear after 4 seconds. Look away, and the user
 * will miss the notification.
 *
 * This module provides notifications that stay alive until the user dismisses
 * them (or until .close()) is called.
 * This module has no side effects in Firefox 21-.
 *
 * See alert.js, alert.xul and alert.css at
 * http://dxr.mozilla.org/mozilla-central/source/toolkit/components/alerts/resources/content/
 *
 * In recent versions of Firefox (e.g. FF 36+ on Linux), XUL notifications have been disabled
 * in favor of native implementations. To re-enable XUL notifications, install the following
 * addon: https://addons.mozilla.org/en-us/firefox/addon/no-native-notifications/
 */

'use strict';
const notifications = require('sdk/notifications');

// Invisible WORD JOINER, used to identify long-lived desktop notifications
const IDENTIFIER = '\u2060';

// Use an array to store the desktop notifications (even though there's only one at a time).
let desktopNotifications = [];
// Detect Desktop notification windows
new require('sdk/deprecated/window-utils').WindowTracker({
    onTrack: function(window) {
        if (window.location.href !== 'chrome://global/content/alerts/alert.xul') {
            return;
        }
        let doc = window.document;
        let label = doc.getElementById('alertTextLabel');
        let alertBox = doc.getElementById('alertBox');
        if (!label || !alertBox) {
            // Implementation changed?
            return;
        }
        if (label.textContent.charAt(0) !== IDENTIFIER) {
            // Desktop notification is not created by us.
            return;
        }
        // Pause the animation.
        // Note: This only works when alerts.disableSlidingEffect is NOT true.
        alertBox.style.animationPlayState = 'paused';
        // As of Firefox 44, the notification is hidden by default and has a close animation,
        // so we need to set the reset the animation, then unpause the animation on click.
        // https://hg.mozilla.org/mozilla-central/rev/6ecebbea7718
        alertBox.style.animationFillMode = 'none';
        alertBox.style.animationName = 'dummy';
        alertBox.addEventListener('click', function listener() {
            alertBox.removeEventListener('click', listener);
            alertBox.style.animationPlayState = '';
            alertBox.style.animationFillMode = '';
            if (alertBox.style.animationName === 'dummy') {
                alertBox.style.animationName = '';
            }
        }, true);
        desktopNotifications.push(window);
    },
    onUntrack: function(window) {
        var index = desktopNotifications.indexOf(window);
        if (index !== -1) {
            desktopNotifications.splice(index, 1);
        }
    }
});

function notify(options) {
    options = Object.create(options);
    options.text = IDENTIFIER + (options.text === void 0 ? '' : options.text);
    return notifications.notify(options);
}
// Not present in sdk/notifications. This module provides a method to persist notifications,
// so it also has to export a method to dismiss the notifications.
function close() {
    while (desktopNotifications.length) {
        desktopNotifications.shift().close();
    }
}

exports.notify = notify;
exports.close = close;
