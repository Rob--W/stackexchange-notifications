/**
 * (c) 2013 Rob Wu <gwnRob@gmail.com> (https://robwu.nl)
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
