---
created: "2026-04-01T18:59:18.910Z"
title: Fix token renewal broken
area: auth
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

Token renewal appears to be broken. Access tokens expire (15m per Phase 1 convention) but the refresh token mechanism does not successfully obtain new access tokens. This causes the user to be silently logged out or get stuck with invalid tokens.

## Solution

- Debug the refresh token endpoint and the frontend's token refresh logic.
- Phase 1 established 15m access JWT + rotating 7-day refresh tokens.
- Check the refresh endpoint response handling in the frontend auth module.
- Verify the refresh token rotation logic isn't invalidating tokens prematurely.
