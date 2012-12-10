## Real-time Desktop notifications for Stack Exchange's inbox
Ported from a Chrome extension since version 1.5. The functionality is the same, the UI is slightly different.
Install it from https://addons.mozilla.org/en-US/firefox/addon/real-time-desktop-notificat/

The add-on can be configured by clicking on the StackExchange icon at the [add-on bar](http://support.mozilla.org/en-US/kb/add-on-bar-quick-access-to-add-ons) (located at the bottom of Firefox's window). If you don't see this bar, press `Ctrl` + `/` to show it.

To create the XPI, get the [Firefox Addon SDK](https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/index.html) and run [`cfx 
xpi`](https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/tutorials/getting-started-with-cfx.html#cfx-xpi).
After generating the XPI, test the extension in old/new Firefox versions, and update install.rdf inside the xpi for optimal compatibility. V1.5 has successfully been tested in Firefox 15.0 - 20.0a1.  
**To make updating easier, run build.sh**
