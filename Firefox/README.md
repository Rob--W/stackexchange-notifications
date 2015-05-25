## Real-time Desktop notifications for Stack Exchange's inbox
Ported from a Chrome extension since version 1.5. The functionality is the same, the UI is slightly different.
Install it from https://addons.mozilla.org/en-US/firefox/addon/real-time-desktop-notificat/

After installing the add-on, show the control panel by clicking  on the Stack Exchange icon at the
[add-on bar](https://support.mozilla.org/en-US/kb/add-on-bar-quick-access-to-add-ons).
If you don't see this bar, press `Ctrl` + `/` to show it.
Click on the "Grant Token" buton to request an access token. After completing the Stack Exchange authentication,
the add-on will autofill the User ID and start listening to inbox notifications.

## Building

To create the XPI, get the [Firefox Addon SDK](https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/index.html) and run [`cfx 
xpi`](https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/tutorials/getting-started-with-cfx.html#cfx-xpi).
After generating the XPI, test the extension in old/new Firefox versions, and update install.rdf inside the xpi for optimal compatibility. V1.5 has successfully been tested in Firefox 15.0 - 20.0a1.  
**To make updating easier, run build.sh**
