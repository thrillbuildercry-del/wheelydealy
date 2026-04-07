# WheelyDealy - Production-ready Firebase Sales App

## Stack
- React + Vite + Tailwind CSS
- Firebase Auth + Firestore + Cloud Functions + Hosting
- Mapbox map visualization

## Features Implemented
- Auth with role-based access (`admin`, `worker`) and guarded routes.
- Firestore schema support for `users`, `products`, `sales`, `settings`, `inventory_logs`.
- Sale flow with:
  - product type -> product -> quantity (1 decimal validation)
  - payment modal with amount or CUFF flag
- Cloud Function transaction for sale creation:
  - inventory deduction
  - prevent negative inventory
  - inventory log insert
  - commission compute
  - personal use support
  - geolocation capture fields
- Admin views:
  - dashboard metrics + chart
  - product CRUD + inventory adjustments
- Map page with marker clustering by rounded coordinate and popup stats.
- Firestore rules enforcing worker/admin access boundaries.

## Environment Variables
Create `.env` in project root:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_MAPBOX_TOKEN=
```

## Local Development
```bash
npm install
npm run dev
```

Cloud Functions:
```bash
cd functions
npm install
cd ..
```

## Firebase Setup
1. Create a Firebase project.
2. Enable Authentication (Email/Password).
3. Create Firestore DB.
4. Deploy rules:
   ```bash
   firebase deploy --only firestore:rules
   ```
5. Deploy functions:
   ```bash
   firebase deploy --only functions
   ```
6. Build + deploy hosting:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

## Data Model
Use these collections:
- `users/{uid}`: `email`, `role`, `createdAt`
- `products/{id}`: `name`, `type`, `total_quantity`, `cost_price`, `sell_price`
- `sales/{id}`: `user_id`, `product_id`, `type`, `quantity`, `total_expected`, `amount_received`, `cuff`, `latitude`, `longitude`, `commission`, `personal_use`, `timestamp`
- `settings/app`: `cuff_enabled`, `commission_type`, `commission_value`, `personal_use_discount`
- `inventory_logs/{id}`: `product_id`, `change_amount`, `reason`, `timestamp`

## Production Notes
- Restrict function invocation with App Check + Firebase Auth.
- Add index definitions for sales reporting queries as needed.
- Prefer all inventory mutations through Cloud Functions only.
- Add CI checks for lint/typecheck/build prior to deployment.
