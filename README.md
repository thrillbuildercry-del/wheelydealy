# WheelyDealy (GitHub Pages + Firebase)

This app is now built to run **without a custom backend server**.
It uses only:
- **GitHub Pages** (hosting)
- **Firebase Authentication** (Google + Email/Password login)
- **Cloud Firestore** (products, users, sales, settings)

---

## 1) What you get

- ✅ Easy login page (Google sign-in + Create account).
- ✅ Two roles: `ADMIN` and `WORKER`.
- ✅ Worker dashboard:
  - Select product type (HARD/SOFT)
  - Enter quantity (max 1 decimal)
  - Payment modal (amount or CUFF)
  - Auto GPS location capture (if browser allows)
- ✅ Admin dashboard:
  - Full product CRUD (add/edit/delete)
  - User management (promote/demote admin/worker, enable/disable)
  - Business settings (CUFF toggle, commissions, personal-use multiplier)
  - Sales location summary with one-click Google Maps links
- ✅ Inventory protection (cannot sell below zero stock)

---

## 2) Very easy setup (copy/paste)

## Prerequisites
- Node.js 20+
- npm 10+
- A Firebase project

## Install
```bash
npm install
```

If your environment has a proxy issue:
```bash
npm run install:deps
```

## Create frontend env file
Create `frontend/.env` with:

```bash
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## Run locally
```bash
npm run dev
```

---

## 3) Firebase console setup (step-by-step)

### A. Enable Authentication
1. Firebase Console → **Authentication** → **Sign-in method**.
2. Enable:
   - **Google**
   - **Email/Password**

### B. Enable Firestore
1. Firebase Console → **Firestore Database**.
2. Create database in production mode.
3. Pick your region.

### C. Add Firestore security rules
Use the repo's `firestore.rules` file and publish rules:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }

    function isAdmin() {
      return signedIn() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'ADMIN';
    }

    match /users/{userId} {
      allow read: if signedIn();
      allow create: if signedIn() && request.auth.uid == userId;
      allow update: if isAdmin() || request.auth.uid == userId;
    }

    match /products/{productId} {
      allow read: if signedIn();
      allow write: if isAdmin();
    }

    match /settings/{docId} {
      allow read: if signedIn();
      allow write: if isAdmin();
    }

    match /sales/{saleId} {
      allow read: if signedIn();
      allow create: if signedIn();
      allow update, delete: if isAdmin();
    }
  }
}
```

### D. Create your first admin user (important)
1. Sign up in the app (email/password or Google).
2. In Firestore, go to `users/<your_uid>`.
3. Change `role` from `WORKER` to `ADMIN`.
4. Refresh app, now you can open Admin Dashboard.

---

## 4) Deploy to GitHub Pages

This project uses `HashRouter`, so it works on GitHub Pages without server rewrites.

### Build
```bash
npm run build
```

The static output is in:
- `frontend/dist`

### Deploy options
- Use GitHub Actions (recommended), or
- Push `frontend/dist` to `gh-pages` branch

---

## 5) How roles work

- **WORKER** can:
  - log in
  - create sales
  - use sale/payment flow
- **ADMIN** can also:
  - manage users
  - manage products/inventory/pricing
  - update app settings (CUFF/commission/personal-use)
  - review location sales summary

---

## 6) Troubleshooting

### I can log in but can’t see Admin page
- Your user document role is probably `WORKER`.
- Update Firestore `users/<uid>.role = ADMIN`.

### Sales fail with inventory error
- Product stock is too low.
- Increase `totalQuantity` in Admin dashboard.

### GPS is missing on sale entries
- Browser location permission denied.
- Allow location and try again.

### NPM install fails with proxy error
- Run:
  ```bash
  npm run install:deps
  ```

---

## 7) File map (quick)

- `frontend/src/lib/firebase.js` → Firebase initialization
- `frontend/src/context/AuthContext.jsx` → login/signup/logout/session + role
- `frontend/src/services/firestoreService.js` → all Firestore reads/writes/business logic
- `frontend/src/pages/LoginPage.jsx` → easy sign-in/create-account UI
- `frontend/src/pages/WorkerDashboard.jsx` → worker flow
- `frontend/src/pages/AdminDashboard.jsx` → full admin editable system

---

If you want, next step I can add a **one-click “seed demo data” button** (admin-only) so first-time setup is even easier.
