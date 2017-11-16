### Desktop Notifications for Stack Exchange, for Firefox

[Version 1.6.12](https://addons.mozilla.org/firefox/addon/real-time-desktop-notificat/versions/1.6.12)
 and earlier were developed using the Add-on SDK.
[Version 2.0 of and later](https://addons.mozilla.org/firefox/addon/real-time-desktop-notificat)
is written with the WebExtensions API, and compatible with Firefox 57 and later.


### Data migration
When you upgrade to a WebExtension, previous settings are not automatically
carried over. You can easily log in again at the add-on's preference page at
`about:addons`, or manually migrate data as follows:

User ID and URL:

1. Visit `about:profiles` to find the location of your profile directory.
2. Open`[path to profile directory]/jetpack/stackexchange-notifications@jetpack/simple-storage/store.json` with a text editor.
3. Open the add-on's preference page (at `about:addons`) and copy the digits
   after `"stackexchange-user-id":"<some digits here>"` from `store.json` to
   the input field for the user ID at the add-on's preference page.
4. Copy the value of `"open-on-click":"<some URL here>"` to the input field for
   the URL at the add-on preference page.
5. Optionally, delete the file from step 2 to clean up.

If you previously allowed the add-on to read the inbox count through the Stack
Exchange API, then you can transfer the API authorization token as follows.

1. Visit `about:preferences#privacy` and click on "Saved Logins".
2. Search for `"dummy_auth_username"`
   (you should see a row for "site" "addon:stackexchange-notifications").
3. Right-click on the row and select "Copy Password".
4. Open `about:debugging`, tick the checkbox "Enable add-on debugging" and
   click on the "Debug" option at this add-on ("Desktop Notifications for Stack
   Exchange").
5. Run the following code snippet in the console of the devtools toolbox that
   appears:

       StackExchangeInbox.auth.setToken('<paste token here>');

6. Close the devtools toolbox. Optionally turn off add-on debugging.
7. Optionally, remove the saved token by clicking on the "Remove" button at the
   "Saved Logins" screen of the browser's preference page (from step 2).


### Development

Run `make firefox` from the root of the repository to build the extension.
If you wish to manually create the extension, copy the contents of `Chrome/` to
this `Firefox/` directory, except for `manifest.json`.
Then visit `about:debugging` and select `Firefox/manifest.json`.
