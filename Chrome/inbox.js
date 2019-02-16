'use strict';

var markingAsRead = false;
var markedAsRead = false;
document.getElementById('mark-as-read').onclick = function(e) {
    e.preventDefault();
    if (markingAsRead) {
        return;
    }
    markingAsRead = true;
    chrome.runtime.sendMessage('markAsRead', function(success) {
        document.getElementById('mark-as-read').hidden = true;
        if (!success) {
            reportError('innerHTML', 'Failed to mark inbox items as read. You have to log in at <a href="https://stackexchange.com/">stackexchange.com</a> before the inbox items can be marked as read.');
            return;
        }
        markedAsRead = true;
        var unreadItmes = document.querySelectorAll('.unread-item');
        for (var i = 0; i < unreadItmes.length; ++i) {
            unreadItmes[i].classList.remove('unread-item');
        }
    });
};

function fetchUnreadContent() {
    chrome.runtime.sendMessage('getUnreadInboxApiUrl', function({apiUrl, inboxLink}) {
        document.querySelector('.all-items-link').href =
        document.querySelector('.all-items-bottom-link').href = inboxLink;

        if (apiUrl) {
            console.assert(apiUrl.startsWith('https://api.stackexchange.com/'), apiUrl + ' is an API URL');
            // Note: No network error handling. StackExchange itself is also
            // poor at handling network errors; it just closes the inbox.
            fetch(apiUrl).then(function(res) {
                return res.json();
            }).then(renderInbox, function(e) {
                reportError('textContent', 'Failed to load the inbox content. ' + e);
            });
        } else {
            // Not sure if there are unread comments.
            // Don't show the mark-as-read option anyway, since checking the
            // succesfulness of markAsRead is difficult without authentication.
            // document.getElementById('mark-as-read').hidden = false;
            document.getElementById('tokenNote').hidden = false;
        }
    });
}

// Prepend error to inbox and scroll to it if needed.
function reportError(innerHTMLOrTextContent, htmlMessage) {
    var div = document.createElement('div');
    div[innerHTMLOrTextContent] = htmlMessage;

    var li = document.createElement('li');
    li.className = 'inbox-item inbox-error';
    li.appendChild(div);

    var ul = document.querySelector('ul');
    ul.insertBefore(li, ul.firstElementChild);
    document.querySelector('.modal-content').scrollTop = 0;
}

function htmlToText(html) {
    var template = document.createElement('template');
    template.innerHTML = html;
    return template.content.textContent;
}

function renderInbox(inboxResponse) {
    // apiResponse = https://api.stackexchange.com/docs/inbox-unread
    var fragment = document.createDocumentFragment();
    var inboxItemTemplate = document.getElementById('inboxItemTemplate').content.querySelector('li');
    var hasAnyUnread = false;
    inboxResponse.items.forEach(function(item) {
        // https://api.stackexchange.com/docs/types/inbox-item
        var li = inboxItemTemplate.cloneNode(true);
        if (item.is_unread && !markedAsRead) {
            li.classList.add('unread-item');
            hasAnyUnread = true;
        }
        if (/^https?:/.test(item.link)) {
            li.querySelector('.item-link').href = item.link;
        }
        if (item.site) {
            li.querySelector('.site-icon').name = item.site.name;
            li.querySelector('.site-icon').style.backgroundImage = 'url(' + item.site.favicon_url + ')';
        }
        li.querySelector('.item-type').textContent = formatItemType(item.item_type);

        var date = new Date(item.creation_date * 1000);
        li.querySelector('.item-creation').title = absoluteTime(item.creation_date);
        li.querySelector('.item-creation').textContent = friendlyTime(item.creation_date);

        li.querySelector('.item-location').textContent = htmlToText(item.title);
        li.querySelector('.item-summary').textContent = htmlToText(item.body);
        fragment.appendChild(li);
    });

    if (hasAnyUnread) {
        document.getElementById('mark-as-read').hidden = false;
    }

    var ul = document.querySelector('ul');
    // Prepend before the "show all item content" link.
    ul.insertBefore(fragment, ul.lastElementChild);
    // Show "show all item content" so that the inbox always looks non-empty and not overflown.
    ul.lastElementChild.hidden = false;
}

function formatItemType(itemType) {
    // https://api.stackexchange.com/docs/types/inbox-item
    // "one of comment, chat_message, new_answer, careers_message,
    // careers_invitations, meta_question, post_notice, or moderator_message"
    //
    // "Be aware that the types of items returned by this method are subject to
    // change at any time. In particular, new types may be introduced without
    // warning. Applications should deal with these changes gracefully."

    if (!itemType) {
        // Unexpected...?
        return '';
    }
    return itemType.replace(/_/g, ' ');
}

// Below time formatters are from https://dev.stackoverflow.com/content/Js/full-anon.en.js
var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function pad(n) {
    return n < 10 ? '0' + n : n;
}
function absoluteTime(ut) {
    var date = new Date();
    date.setTime(ut * 1000);

    return [
        date.getUTCFullYear(),
        '-', pad(date.getUTCMonth() + 1),
        '-', pad(date.getUTCDate()),
        ' ', pad(date.getUTCHours()),
        ':', pad(date.getUTCMinutes()),
        ':', pad(date.getUTCSeconds()),
        'Z'
    ].join('');
}
function friendlyTime(dt) {
    var utcNow = Math.floor((new Date()).getTime() / 1000);

    var delta = utcNow - dt;
    var seconds = delta % 60;
    var minutes = Math.floor(delta / 60);
    var hours = Math.floor(delta / 3600);
    if (delta < 1) {
        return 'just now';
    }
    if (delta < 60) {
        return (function(n) {
            return n.seconds == 1 ? n.seconds + ' sec ago' : n.seconds + ' secs ago';
        })({
            seconds: seconds
        });
    }
    if (delta < 3600) // 60 mins * 60 sec
    {
        return (function(n) {
            return n.minutes == 1 ? n.minutes + ' min ago' : n.minutes + ' mins ago';
        })({
            minutes: minutes
        });
    }
    if (delta < 86400) // 24 hrs * 60 mins * 60 sec
    {
        return (function(n) {
            return n.hours == 1 ? n.hours + ' hour ago' : n.hours + ' hours ago';
        })({
            hours: hours
        });
    }

    var days = Math.floor(delta / 86400);

    if (days == 1) {
        return 'yesterday';
    } else if (days <= 2) {
        return (function(n) {
            return n.__count == 1 ? n.__count + ' day ago' : n.__count + ' days ago';
        })({
            __count: days
        });
    }

    var date = new Date(dt * 1000);
    return (function(n) {
        return n.month + ' ' + n.date + ' at ' + n.hours + ':' + n.minutes;
    })({
        month: months[date.getMonth()],
        date: date.getDate(),
        hours: date.getHours(),
        minutes: pad(date.getMinutes())
    });
}

fetchUnreadContent();
