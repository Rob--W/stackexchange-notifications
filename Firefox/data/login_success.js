// Example of hash: #access_token=ZxqGlCmJzvrr99D(9dcEwA))&state=3&expires=86400
var token = location.hash.match(/\baccess_token=([^&]+)/);
var account_id = document.querySelector('a[href*="/users/"]');
if (account_id) {
    account_id = account_id.getAttribute('href').match(/\d+/)[0];
}
self.port.emit('message', JSON.stringify({
    auth_token: token && token[1],
    account_id: account_id
}));
window.close();
