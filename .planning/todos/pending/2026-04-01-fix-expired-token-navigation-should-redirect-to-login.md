---
created: "2026-04-01T18:59:18.910Z"
title: Fix expired token navigation should redirect to login
area: auth
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

When navigating internally with an expired token and the token refresh fails, the user is NOT redirected to the login page. They end up stuck on a broken page with invalid credentials. The expected behavior is: invalid token + failed renewal = hard redirect to `/` (login).

## Solution

- Add a global interceptor/guard that detects 401 responses from the API.
- If the refresh token also fails, clear stored tokens and redirect to login.
- This should work for all API calls, not just specific routes.
- The auth gate (established in Phase 1) should enforce this at the router level.
