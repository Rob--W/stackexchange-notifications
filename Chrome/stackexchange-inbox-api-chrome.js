// Adapter for Chrome
StackExchangeInbox.auth.requestToken = function() {
    chrome.windows.create({
        url: StackExchangeInbox.auth.API_AUTH_URL,
        focused: true,
        type: 'popup',
        top: 0,
        left: Math.max(0, (screen.availWidth - 660) / 2),
        height: Math.min(screen.availHeight, 480),
        width: Math.min(screen.availWidth, 660)
    });
};
// Handle successful authentication
chrome.extension.onMessage.addListener(function(message, sender) {
    if ('auth_token' in message) {
        if (message.auth_token) {
            StackExchangeInbox.auth.setToken(message.auth_token);
        }
        if (message.account_id) {
            StackExchangeInbox.emit('found:account_id', message.account_id);
        }
        chrome.tabs.remove(sender.tab.id);
    }
});