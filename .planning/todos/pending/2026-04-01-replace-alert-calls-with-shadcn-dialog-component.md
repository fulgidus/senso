---
created: "2026-04-01T18:59:18.910Z"
title: Replace alert() calls with shadcn dialog component
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

The app uses native `alert()` calls which produce ugly, unstyled browser dialogs that diminish the UX. In a PWA/hackathon context, these look especially bad and break the polished feel.

## Solution

- Create a reusable confirmation/alert dialog component based on shadcn/ui Dialog.
- Features: blurred background overlay, animations, customizable title/message/actions.
- Search the codebase for all `alert(` calls and replace them with the new component.
- Consider a `useConfirm()` or `useAlert()` hook for easy adoption across the app.
