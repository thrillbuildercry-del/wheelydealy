# Firestore Rules Update (recommended)

Use these rules to support the app features in `index.html` (driver schedule, vehicle details, customer orders, and admin operations).

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }

    function rosterPath(uid) {
      return /databases/$(database)/documents/artifacts/sales-tracker-v1/public/data/roster/$(uid);
    }

    function myRoster() {
      return signedIn() && exists(rosterPath(request.auth.uid))
        ? get(rosterPath(request.auth.uid)).data
        : null;
    }

    function isAdmin() {
      return signedIn() && myRoster() != null && myRoster().role == 'admin';
    }

    function isDriver() {
      return signedIn() && myRoster() != null && (myRoster().role == 'driver' || myRoster().role == 'admin');
    }

    function isActiveDriver() {
      return isDriver() && (myRoster().accessStatus == 'active' || myRoster().accessStatus == 'approved' || myRoster().role == 'admin');
    }

    function onlyKeysChanged(allowed) {
      return request.resource.data.diff(resource.data).affectedKeys().hasOnly(allowed);
    }

    function rosterSelfServiceUpdate(uid) {
      return signedIn()
        && request.auth.uid == uid
        && onlyKeysChanged(['onlineStatus', 'vehicle', 'shifts', 'stock', 'debt', 'todayProfit']);
    }

    function rosterCoverAcceptanceUpdate(uid) {
      return isActiveDriver()
        && uid != request.auth.uid
        && onlyKeysChanged(['shifts'])
        && request.resource.data.role == resource.data.role
        && request.resource.data.accessStatus == resource.data.accessStatus
        && request.resource.data.uid == resource.data.uid;
    }

    function buyerOrderUpdate() {
      return signedIn()
        && resource.data.buyerUid == request.auth.uid
        && onlyKeysChanged(['remindRequested'])
        && request.resource.data.remindRequested == true
        && request.resource.data.status == resource.data.status
        && request.resource.data.driverUid == resource.data.driverUid
        && request.resource.data.price == resource.data.price
        && request.resource.data.qty == resource.data.qty;
    }

    // Private user app state (stock/debt/history/vehicle)
    match /artifacts/sales-tracker-v1/users/{uid}/data/{docId} {
      allow read, write: if signedIn() && request.auth.uid == uid;
    }

    // User profile settings
    match /artifacts/sales-tracker-v1/users/{uid}/settings/{docId} {
      allow read: if signedIn() && request.auth.uid == uid;
      allow write: if signedIn() && (request.auth.uid == uid || isAdmin());
    }

    // Public roster and shifts
    match /artifacts/sales-tracker-v1/public/data/roster/{uid} {
      allow read: if signedIn();
      allow create: if signedIn() && request.auth.uid == uid;
      allow update: if isAdmin() || rosterSelfServiceUpdate(uid) || rosterCoverAcceptanceUpdate(uid);
      allow delete: if isAdmin();
    }

    // Orders: customers create, drivers/admins update workflow
    match /artifacts/sales-tracker-v1/public/data/orders/{orderId} {
      allow read: if signedIn();
      allow create: if signedIn();
      allow update: if isAdmin()
        || buyerOrderUpdate()
        || (isActiveDriver() && (
            resource.data.driverUid == request.auth.uid
            || (resource.data.status == 'pending' && request.resource.data.driverUid == request.auth.uid)
        ));
      allow delete: if isAdmin();
    }

    // Cover requests + stock requests
    match /artifacts/sales-tracker-v1/public/data/cover_requests/{id} {
      allow read: if signedIn();
      allow create: if isActiveDriver();
      allow update, delete: if isAdmin() || isActiveDriver();
    }

    match /artifacts/sales-tracker-v1/public/data/stock_requests/{id} {
      allow read: if signedIn();
      allow create: if isActiveDriver();
      allow update, delete: if isAdmin();
    }

    // Master inventory
    match /artifacts/sales-tracker-v1/public/data/inventory/{id} {
      allow read: if signedIn();
      allow write: if isAdmin();
    }
  }
}
```

## Notes
- These rules expect `role` and `accessStatus` fields in `public/data/roster/{uid}`.
- Roster self-updates are intentionally limited to operational fields (`onlineStatus`, `vehicle`, `shifts`, `stock`, `debt`, `todayProfit`) so drivers cannot self-promote their `role`/`accessStatus`.
- The `rosterCoverAcceptanceUpdate` path permits active drivers to update another driver's `shifts` only, which keeps the `driverAcceptCover()` flow working without opening up broader cross-user writes.
- Buyers are restricted to reminder metadata updates on orders and cannot modify dispatch/financial fields such as `status`, `driverUid`, `price`, or `qty`.
- If you keep `appId` configurable, duplicate/parameterize the path prefix currently hardcoded as `sales-tracker-v1`.
