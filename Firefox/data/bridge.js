addEventListener('message', function(event) {
    if (event.data.charAt(0) == '#') { // Proxied console.log
        console.log(event.data.slice(1));
        return;
    }
    self.port.emit('options_message', event.data);
});