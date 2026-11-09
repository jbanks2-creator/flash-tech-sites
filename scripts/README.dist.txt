TaskApp @VERSION@ — single-file edition
=======================================

Thank you for buying TaskApp. This file is the whole product: one HTML file, no
installer, no account, no server.


HOW TO OPEN IT
--------------
1. Save TaskApp-@VERSION@.html anywhere you keep things — your Documents folder is fine.
2. Double-click it. It opens in Chrome, Edge, Firefox or Safari.
3. That is the whole install. It works offline, on a plane, with the Wi-Fi switched off.

Tip: drag the file to your bookmarks bar, or right-click it and "Send to desktop",
so it is one click away tomorrow morning.


WHERE YOUR DATA LIVES — PLEASE READ THIS BIT
-------------------------------------------
Your tasks live in the storage of the browser you open this file with. They are not
uploaded anywhere, they are not synced, and nobody — including us — can see or recover
them. That is the point of the product, and it is also its one rule:

  * Export a backup at least once a week.
    Settings → Export backup (.json) → save it in your Google Drive / OneDrive folder.

  * Clearing "cookies and site data" in your browser deletes your tasks.
    So does uninstalling the browser, using a private window, or "cleaning" software.

  * Opening the file in a different browser, or on a different computer, starts empty.
    Use Export on the old one and Import on the new one.


BACKUP, RESTORE, MOVE
--------------------
Export  Settings → Export backup (.json). One file, readable text, yours.
Import  Settings → Import / merge backup. Same ids are updated, new ones added,
        nothing is deleted. A safety copy of your current data downloads first.
The export file opens in any text editor, so your data is never locked in.


PRINTING AND PDF
----------------
The Print button in the header prints the view you are looking at as a clean, light
sheet. For a PDF, choose "Save as PDF" as the printer. Ctrl+P (Windows) or Cmd+P (Mac)
does the same thing.


GETTING STARTED
---------------
First run offers three choices: start empty, load the demo workspace, or import a
backup. The demo is a fictional IT services company — look around, then clear it in
Settings → Clear demo data. Press ? at any time for the one-page guide and the
keyboard shortcuts.


SUPPORT
-------
Email the address on your purchase receipt (the support address is being finalised
for this beta; if the receipt has none, reply to the order email). Tell us:

  * the version — shown in the header and in Settings → About (this copy is @VERSION@)
  * what you did, and what happened instead
  * your browser and operating system

Please do not send us your data file unless we ask for it. We do not want your client
information and we do not need it to diagnose a bug.


LICENCE
-------
Licensed, not sold. One licence covers one named user on one computer; moving to a
replacement computer is fine. The full end-user licence agreement (EULA) is supplied
with your purchase and governs your use of this file. This build is a release
candidate: the licence screen is present but does not check keys yet, and no feature
is restricted.


VERIFY YOUR DOWNLOAD
--------------------
The checksum of this file is in TaskApp-@VERSION@.html.sha256. To check it:

  Windows (PowerShell):  Get-FileHash .\TaskApp-@VERSION@.html -Algorithm SHA256
  macOS / Linux:         shasum -a 256 TaskApp-@VERSION@.html
                         sha256sum -c TaskApp-@VERSION@.html.sha256

If the hash does not match, the file was damaged or altered in transit — ask for a
fresh copy before you put real work into it.
