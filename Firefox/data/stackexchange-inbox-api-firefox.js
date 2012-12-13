// Adapter for Firefox
StackExchangeInbox.auth.requestToken = function() {
    window.open(StackExchangeInbox.auth.API_AUTH_URL, '', 'width=660,height=480');
};
// Handle successful authentication
addEventListener('message', function(e) {
    if (!/^>/.test(e.data)) return;
    var message = JSON.parse(e.data.slice(1));
    if ('auth_token' in message) {
        if (message.auth_token) {
            StackExchangeInbox.auth.setToken(message.auth_token);
        }
    }
});