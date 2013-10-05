// Adapter for Firefox
StackExchangeInbox.auth.requestToken = function() {
    window.open(StackExchangeInbox.auth.API_AUTH_URL, '', 'width=660,height=480');
};
(function() {
    // Received from main.js, via bridge.js
    var cachedToken = document.documentElement.getAttribute('token') || '';
    document.documentElement.removeAttribute('token');

    StackExchangeInbox.auth.getToken = function getToken() {
        return cachedToken;
    };
    StackExchangeInbox.auth.setToken = function setToken(token) {
        cachedToken = token;
        postMessage(JSON.stringify({
            method: 'auth.setToken',
            token: token
        }), '*');
    };
    // Migrate from old version
    // Don't store the token in localStorage, but in Firefox's password manager
    if (!cachedToken && localStorage.getItem('se_auth_token')) {
        StackExchangeInbox.auth.setToken(localStorage.getItem('se_auth_token'));
        localStorage.removeItem('se_auth_token');
    }
})();

// Handle successful authentication
addEventListener('message', function(e) {
    if (!/^>/.test(e.data)) return;
    var message = JSON.parse(e.data.slice(1));
    if ('auth_token' in message) {
        if (message.auth_token) {
            StackExchangeInbox.auth.setToken(message.auth_token);
        }
        if (message.account_id) {
            StackExchangeInbox.emit('found:account_id', message.account_id);
        }
    }
});
