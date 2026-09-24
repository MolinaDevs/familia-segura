---
name: Expo preview route validation
description: How to avoid false 404 failures when validating Expo artifacts through Replit previews.
---

Generic browser testing can resolve an Expo artifact's path differently from the artifact-aware app preview. A tester may see a proxy 404 at both the workspace root and the artifact-prefixed route even while the Expo preview is healthy.

**Why:** The Expo artifact bypasses the shared path prefix, while generic browser contexts can remain attached to the workspace router. This produced false failures despite successful bundles, clean app logs, and artifact-aware screenshots.

**How to apply:** For Expo UI availability and responsive layout, use the artifact-aware app preview. Treat a generic browser-test 404 as a routing-harness issue when the Expo workflow is running and the artifact-aware preview renders the same route.