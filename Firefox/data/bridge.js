/**
 * postMessage is used to transport messages
 * #... = Print message in console
 * >... = Message from main to options
 * Default = Message from options to main
 */
addEventListener('message', function(event) {
    var type = /^#|>|/.exec(event.data)[0];
    if (type == '#') { // Proxied console.log
        console.log(event.data.slice(1));
    } else if (type != '>') {
        self.port.emit('options_message', event.data);
    }
});
self.port.on('to_options_message', function(message) {
    document.defaultView.postMessage('>' + message, '*');
});
// Synchronously pass the token to the options panel
// The attribute will be removed upon first read
document.documentElement.setAttribute('token', self.options.token || '');
// Synchronously pass the initial data used to populate a fake localStorage object
document.documentElement.setAttribute('localStorageData', JSON.stringify(self.options.localStorageData));
document.addEventListener('localStorageChange', function(event) {
    self.port.emit('localStorageChange', event.detail);
});
