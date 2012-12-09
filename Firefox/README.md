## Real-time Desktop notifications for Stack Exchange's inbox
This Firefox add-on has the same functionality as the Chrome extension.


To create the XPI, get the [Firefox Addon SDK](https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/index.html) and run [`cfx 
xpi`](https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/tutorials/getting-started-with-cfx.html#cfx-xpi).
After generating the XPI, test the extension in old/new Firefox versions, and update install.rdf inside the xpi for optimal compatibility. V1.5 has successfully been tested in Firefox 15.0 - 20.0a1.
