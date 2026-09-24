---
name: iOS block-source isolation
description: Why Screen Time routine enforcement must not share removal operations with per-app rules.
---

Routine downtime must use an independent Managed Settings mechanism from permanent and daily per-app blocks. Consolidate overlapping routine windows before scheduling them, and never let one source's end callback remove another source's restriction.

**Why:** The generic selection blocklist is token-based rather than reason-based. Removing a selection at the end of a routine can silently remove a daily-limit or permanent guardian block for the same token.

**How to apply:** Use block-all mode for merged routine windows and selection blocks for permanent/daily rules. Daily rollover may remove only its own monitored selection. Reapply the current union whenever the child app returns to the foreground.