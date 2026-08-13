# BYDRRM Weather Web v0.1

Manual weather-advisory workflow for authorized BYDRRM personnel.

## Included
- Existing BYDRRM Firebase Google sign-in and approved-user gate
- Dashboard with Draft / Ready / Published counts
- Manual Advisory Studio with all 24 Bulacan LGUs
- Yellow / Orange / Red / General warning styling
- 1080 × 1350 canvas graphic generator
- Auto-generated editable Facebook caption
- PNG download and caption copy
- Manual **Post Now** handoff using Web Share when supported
- Desktop fallback: download PNG + copy caption + open Facebook
- Local Draft → Ready → Published history, edit, duplicate and delete

## Publishing behavior
There is **no scheduled or background auto-posting**. Post Now requires a volunteer to review the advisory, confirm two checks, and manually choose the destination. The app does not mark a post Published unless the user confirms it or marks it Published in History.

## Data note
Advisory history uses browser `localStorage` in v0.1. PAGASA live-feed ingestion and shared Firestore advisory storage are intentionally deferred to the next phase.
