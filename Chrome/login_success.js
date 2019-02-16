(function() {
    if (!/[#&]state=robw(&|$)/.test(location.hash)) {
        // OAuth not initiated by my application.
        return;
    }

    // Example of hash: #access_token=ZxqGlCmJzvrr99D(9dcEwA))&state=robw&expires=86400
    var token = location.hash.match(/\baccess_token=([^&]+)/)[1];

    var x = new XMLHttpRequest();
    x.open('GET', 'https://api.stackexchange.com/2.2/access-tokens/' + token);
    x.responseType = 'json';
    x.onloadend = function() {
        var account_id = x.response && x.response.items[0].account_id;
        chrome.runtime.sendMessage({
            auth_token: token,
            account_id: account_id,
        });
    };
    x.send();
})();
