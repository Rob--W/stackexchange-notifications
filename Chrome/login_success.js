// Example of hash: #access_token=ZxqGlCmJzvrr99D(9dcEwA))&state=3&expires=86400
var token = location.hash.match(/\baccess_token=([^&]+)/);
chrome.extension.sendMessage({
    auth_token: token && token[1]
});
