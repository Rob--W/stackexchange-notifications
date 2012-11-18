var bg = chrome.extension.getBackgroundPage();
document.getElementById('unread-count').textContent = bg.getUnreadCount();
var link = document.getElementById('link');
link.title = link.href = bg.getLink() || bg.generateDefaultLink();
link.onclick = function(e) {
    e.preventDefault();
    chrome.tabs.create({
        url: this.href,
        active: true,
        incognito: !!localStorage.getItem('incognito')
    });
};
