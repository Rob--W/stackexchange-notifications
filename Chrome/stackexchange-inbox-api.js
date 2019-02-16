(function(exports) {
    // Rob's API details
    var API_KEY = 'vNbKvxXtPqz2b7HO*24E2A((';
    var API_CLIENT_ID = '903';
    
    // URLs for getting API token. Sufficed URL with "robw" to create a semi-unique URL to avoid conflicts with others
    // See also https://stackapps.com/questions/8233/oauth-redirect-uri-to-https-stackexchange-com-oauth-login-successxxx-strips-p
    var _api_auth_redirect_url = 'https://stackexchange.com/oauth/login_success';
    var API_AUTH_URL = 'https://stackexchange.com/oauth/dialog?' +
                    'client_id=' + API_CLIENT_ID +
                    '&scope=no_expiry,read_inbox' +
                    '&state=robw' +
                    '&redirect_uri=' + encodeURIComponent(_api_auth_redirect_url);

                    // Multiple API filters to bypass the cache
    // Calculate filters at https://api.stackexchange.com/docs/inbox#pagesize=20&filter=!%29r4d5VTgcrvtUU_Bu3I5&run=true
    //
    // `is_unread` is the information we need.
    // `site` alone does not return extra information
    // `question_id`, `item_type`, `answer_id`, `comment_id`  are reasonably small values
    //
    // Using 10 filters, and 60 different page sizes, we can new values 600 times.
    var API_FILTERS = [
        '!)r4d5VTgcrvtUU_Bu3I5',        // is_unread
        '!LSz0qj2Wk0sCvrPsvrxAs1',      // is_unread + site
        '!)r4d5VTgcj78PZBzhVfa',        // is_unread + item_type
        '!LSz0qj2Wk0s476KxYakcBX',      // is_unread + item_type + site
        '!LSz0qj2Weapn)PFIwGRjd*',      // is_unread + question_id
        '!LSz0qj2Wk0MEDssKb7Z((X',      // is_unread + question_id + site
        '!LSz0qj2Wcn70m_zKsxpXR1',      // is_unread + comment_id
        '!0UYY-ITj0_U7w4VST9Dmw-S0*',   // is_unread + comment_id + site
        '!)r4d5VTgcrvstSSV)86a',        // is_unread + answer_id
        '!LSz0qj2Wk0sCvqoqo6.FgX'       // is_unread + answer_id + site
    ];
    var API_MINIMUM_PAGESIZE = 40;
    var API_MAXIMUM_PAGESIZE = 100;

    // basic = body + creation_date + is_unread + item_type + link + site + title + site.favicon_url + site.name (+unsafe filter)
    // https://api.stackexchange.com/docs/inbox#filter=)-wpJO8qkn.bBXNMrk*hhvIVGJM
    var API_CONTENT_FILTERS = [
        ')-wpJO8qkn.bBXNMrk*hhvIVGJM',  // basic
        '00A4G31njJrnVua5SFynYaYA',     // basic + question_id
        ')-wpJO8qkn.bBXNsIUQRs0MFdgr',  // basic + comment_id
        ')-wpJO8qkn.bBXNMSIc*YZ9p2Lj',  // basic + answer_id
        '00A4G31njJrnVV8jm5besN_Y',     // basic + question_id + answer_id
        '00A4G31njJro)LKYBQ3rIyvf ',    // basic + question_id + comment_id
        '00A4G31njJrsptLF7H_G9SEf',     // basic + comment_id + answer_id
        ')IfYcugX7YVvCSCm6_PswS2',      // basic + question_id + comment_id + answer_id
    ];

    /////////////////////
    // API Definition  //
    /////////////////////
    /**
     * Emitted events:
     * - change:unread
     * - change:token
     * - error
     */
    var StackExchangeInbox = {
        auth: {
            requestToken: requestToken,     // void requestToken()
            getToken: getToken,             // string getToken()
            setToken: setToken,             // void setToken(string token)
            API_AUTH_URL: API_AUTH_URL
        },
        fetchUnreadCount: fetchUnreadCount,  // void fetchUnreadCount( function callback(unreadCount) )
        getUnreadInboxApiUrl: getUnreadInboxApiUrl, // string getUnreadInboxApiUrl()
        markAsRead: markAsRead, // void markAsRead( function(isSuccess) )
        // Very simple event emitter
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
    
    /////////////////////
    // Authentication  //
    /////////////////////
    function requestToken() {
        throw Error('api.requestToken not implemented! Write an environment-specific adapter for this method!');
    }
    function getToken() {
        throw new Error('api.getToken not implemented! Write an environment-specific adapter for this method!');
    }
    function setToken(token) {
        throw new Error('api.setToken not implemented! Write an environment-specific adapter for this method!');
        //StackExchangeInbox.emit('change:token', token);
    }


    var _api_filter = 0;
    var _api_pagesize = API_MAXIMUM_PAGESIZE;
    function generateStackExchangeAPIURL() {
        if (_api_pagesize > API_MINIMUM_PAGESIZE) {
            // Page can be decreased
            _api_pagesize--;
        } else {
            // We've hit the bottom page size. Go to the max page size and change filter
            _api_pagesize = API_MAXIMUM_PAGESIZE;
            ++_api_filter;
            if (_api_filter >= API_FILTERS.length) {
                // Next filter does not exists, use first one.
                _api_filter = 0;
            }
        }
        var url = 'https://api.stackexchange.com/2.1/inbox';
        url += '?key=' + API_KEY;
        url += '&access_token=' + StackExchangeInbox.auth.getToken();
        url += '&filter=' + API_FILTERS[_api_filter];
        url += '&pagesize=' + _api_pagesize;
        return url;
    }

    var _api_content_filter = 0;
    function getUnreadInboxApiUrl() {
        if (!StackExchangeInbox.auth.getToken()) {
            return '';
        }
        // Let's keep this simple, without paging.
        var url = 'https://api.stackexchange.com/2.1/inbox';
        url += '?key=' + API_KEY;
        url += '&access_token=' + StackExchangeInbox.auth.getToken();
        url += '&filter=' + API_CONTENT_FILTERS[_api_content_filter];
        url += '&pagesize=32';

        _api_content_filter = (_api_content_filter + 1) % API_CONTENT_FILTERS.length;

        return url;
    }

    // Get inbox entries
    function fetchUnreadCount(callback) {
        callback = callback || function(unreadCount) {};
        if (!StackExchangeInbox.auth.getToken()) {
            // No token? No request!
            StackExchangeInbox.emit('error', 'No access token found, cannot connect to StackExchange API');
            callback(-1);
            return;
        }
        var url = generateStackExchangeAPIURL();
        var x = new XMLHttpRequest();
        x.open('GET', url);
        x.onload = function() {
            var data = JSON.parse(x.responseText);
            if (data.error_id) {
                StackExchangeInbox.emit('error', 'API responded with ' + data.error_id + ' ' + data.error_name + ', ' + data.error_message);
                if (data.error_id == 403) {
                    // Token is invalid, Discard it
                    StackExchangeInbox.auth.setToken('');
                }
                callback(-1);
                return;
            }
            var unreadCount = data.items.reduce(function(unreadCount, item) {
                return unreadCount += item.is_unread ? 1 : 0;
            }, 0);
            StackExchangeInbox.emit('change:unread', unreadCount);
            callback(unreadCount);
        };
        x.onerror = function() {
            StackExchangeInbox.emit('error', 'Failed to get unread count:  ' + x.status + ' ' + x.statusText);
            callback(-1);
        };
        x.send();
    }

    function markAsRead(callback) {
        var loader = new Image();
        loader.onload = loader.onerror = function() {
            loader.onload = loader.onerror = null;
            fetchUnreadCount(function(unreadCount) {
                // successfully marked as unread if the count is 0.
                callback(unreadCount === 0);
            });
        };
        loader.src = 'https://stackexchange.com/topbar/inbox?_=' + Date.now();
    }

    exports.StackExchangeInbox = StackExchangeInbox;
})(typeof exports == 'undefined' ? this : exports);
