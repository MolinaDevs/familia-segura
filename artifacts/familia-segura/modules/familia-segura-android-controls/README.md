# Família Segura Android Controls

Local Expo Module for Android usage access, accessibility-based blocking, and
offline policy enforcement. The module is discovered automatically from the
app's default `modules` directory.

The host app must expose these native functions to its JS layer:

- `isAvailable()`
- `getProtectionStatus()`
- `openUsageAccessSettings()`
- `openAccessibilitySettings()`
- `openBatteryOptimizationSettings()`
- `savePolicies(policy)`
- `getUsageToday(packageNames)`

`savePolicies` accepts an object with `apps` (`packageName`, `appName`,
`status`, `dailyLimitMinutes`) and `routines` (`days`, `startTime`, `endTime`,
`enabled`). The saved JSON is intentionally local and remains available to the
accessibility service if JavaScript is not running.

Policies carry a renewable 72-hour offline lease. The app refreshes that lease
only after an authenticated overview sync. This preserves short offline periods
without allowing a revoked device to enforce stale rules indefinitely.

## Play Console and user disclosure

Before distributing an Android build, complete the Play Console Accessibility
Service declaration and accurately explain the core parental-control use case.
The app must show a prominent, clear disclosure before directing a user to
enable the service, explain what app/package names are checked and why, and
obtain affirmative consent. The service does not retrieve window content and
does not use overlays. Keep the store listing, in-app disclosure, privacy
policy, and declared Accessibility API use consistent.

Native validation requires an Android development build installed on a device
or emulator. Expo Go cannot load this local native service. Usage access and
Accessibility are user-enabled in Android Settings; battery optimization opens
the general system settings page and is not silently requested.