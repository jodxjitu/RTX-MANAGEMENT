RTX Rent Management - Complete Fixed Version

HOW TO RUN:
1. Extract ZIP.
2. Open folder in VS Code.
3. Right click index.html -> Open with Live Server.
4. Login PIN: 2011

VERY IMPORTANT FIREBASE SETUP:
If website shows "Database Error" or "Permission denied", your Firebase Realtime Database rules are blocking the website.

Go to:
Firebase Console -> Build -> Realtime Database -> Rules

Paste these rules in Firebase Realtime Database:
{
  "rules": {
    ".read": true,
    ".write": true
  }
}

Then click Publish.

NOTE:
- For security, later restrict rules with authentication before public hosting.
- After website is final, use Firebase Auth based secure rules.
- This project uses Realtime Database, not Firestore.

Included files:
index.html
styles.css
firebase-config.js
app.js
database.rules.json

UPDATE: Rent aur Electricity me From Date / To Date period fields add kiye gaye hain. Receipt, history table aur reports me bhi period dikhega.

Logo Update:
- assets/rtx-logo.png = full generated logo
- assets/rtx-logo-icon.png = website icon/sidebar/receipt logo
- assets/favicon.png = browser tab icon
Logo added in login page, sidebar, topbar, receipts and report print.


Responsive Pro Update:
- Mobile + PC compatible layout added.
- Mobile sidebar overlay added.
- Tables, forms, cards, receipt modal and dashboard improved for small screens.
- Better smooth animations added with hover shine, soft page/card entry and reduced lag on touch devices.
