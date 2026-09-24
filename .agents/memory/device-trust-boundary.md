---
name: Device trust boundary
description: Security boundary that downstream native enforcement must preserve.
---

Child mode must authenticate with a revocable, device-specific credential issued during one-time pairing. Child IDs are identifiers, not credentials, and a guardian session must not be reused as child-device authority.

**Why:** Native iOS and Android enforcement will extend the current pairing model. Weakening this boundary would allow impersonation, break revocation, or expose one family’s data to another device.

**How to apply:** Preserve this boundary when adding native controls, background sync, push notifications, and device registration. Store only hashes of device credentials on the server and keep offline behavior read-only when authority cannot be verified.

Offline enforcement policies must use a bounded lease that is renewed only after a successful device-authenticated policy fetch. Cached data, foreground events, and failed refreshes must never extend the lease; explicit authorization failure should clear local enforcement immediately.

**Why:** Without an authenticated lease, an offline or revoked device can keep renewing stale blocks indefinitely from cached policy data.

**How to apply:** Tie lease renewal to a newly completed authenticated response, retain policies only for the agreed offline window, and fail open after expiry.