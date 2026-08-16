# BYDRRM Weather Advisory V1

Modern Bulacan-focused weather advisory website + protected admin dashboard, designed to sit beside the existing BYDRRM Studio without replacing it.

## Locked product decisions
- Full Auto Facebook posting (no approval step)
- Official source: DOST-PAGASA
- V1 advisory types: Heavy Rainfall Warning, Thunderstorm Advisory, TCWS
- Public website + protected admin dashboard
- Existing BYDRRM Firebase project/user approval model reused
- Selected volunteers and admins only for the dashboard
- Existing BYDRRM logo reused from the previous Studio package
- Modern science/weather-media visual direction
- Fail-closed auto-posting: parser confidence must be >= 0.95

## Included
- `public/index.html` public live advisory page
- `public/admin.html` operations dashboard
- `public/radar.html` Bulacan Radar + Infrared Studio
- Firebase Auth + Firestore client integration
- Scheduled scanner every 5 minutes in Asia/Manila
- PAGASA NCR-PRSD Heavy Rainfall parser
- PAGASA Thunderstorm parser with Bulacan filter
- TCWS parser scaffold with fail-closed Bulacan extraction
- Deterministic Facebook caption generator
- Server-side 1080x1350 PNG generator using Sharp
- Server-side Meta Page photo publishing
- Duplicate protection using advisory keys
- Posting logs in `weather_advisories`
- Emergency auto-post pause

## Bulacan Radar + Infrared Studio
The Radar Studio is available at `/radar.html` and uses the same BYDRRM logo already bundled with the Weather project.

Features:
- Bulacan-centered interactive map with municipal boundaries and a highlighted province outline
- Layer modes: Radar (dBZ), Rain Rate (mm/hr), Infrared (°C), and Combined
- Windy-inspired infrared palette: gray/green/yellow/orange/red/dark red while preserving correct scientific units
- Embedded official PAGASA PANaHON radar viewer for live source reference
- Local multi-frame image loading for PAGASA radar/satellite frames
- Adjustable frame opacity and geographic bounds calibration
- Timeline playback with previous/next controls
- Clean branded PNG export for the current frame
- Animated GIF export from up to 12 chronological frames
- BYDRRM logo, timestamp, layer label, legend and DOST-PAGASA source attribution on exports

### Important data-source behavior
PANaHON publicly exposes Radar Mosaic, Hybrid Reflectivity, Rain Rate and Himawari IR in its interactive viewer, but this repository does not assume or invent an undocumented public machine-readable tile/image API. The page therefore keeps the official PANaHON viewer embedded as the live reference and accepts official image frames locally for BYDRRM overlay/export.

When PAGASA provides or confirms a stable machine-readable radar/satellite endpoint suitable for third-party use, connect it in `public/assets/radar.js` and keep the current local-frame workflow as a manual fallback. Do not label third-party radar data as PAGASA data.

Municipal boundaries are loaded from the open `faeldon/philippines-json-maps` dataset, with a built-in Bulacan province polygon fallback if the external boundary file is unavailable.

## Important: Facebook Page link
Provided Page URL: https://www.facebook.com/share/195nV8wz7s/

A Facebook share URL is not the Meta Graph `PAGE_ID`. Do not hardcode the share URL as a Page ID. During Meta setup, connect the Page and store the actual Page ID as the `META_PAGE_ID` Firebase secret.

## Meta setup
The backend expects:
- `META_PAGE_ACCESS_TOKEN`
- `META_PAGE_ID`

Set them with:
```bash
firebase functions:secrets:set META_PAGE_ACCESS_TOKEN
firebase functions:secrets:set META_PAGE_ID
```

The Meta app must be authorized to publish to the Page. Keep the Page access token server-side only.

## Firebase hosting: create a separate site
This package uses the existing Firebase project `bydrrm-studio`, but a new Hosting site/target so the current BYDRRM Studio is not overwritten.

Suggested site id: `bydrrm-weather`

```bash
firebase login
firebase use bydrrm-studio
firebase hosting:sites:create bydrrm-weather
firebase target:apply hosting weather bydrrm-weather
```

Then deploy only this new site and weather functions:
```bash
cd functions
npm install
npm test
cd ..
firebase deploy --only functions
firebase deploy --only hosting:weather
```

## Firestore rules
`firestore-weather.rules.snippet` is intentionally only a merge block. Add it to the existing Studio rules instead of overwriting the whole rules file.

Public users can read `weather_advisories`. Only approved users can read settings, and only admins can change settings. Weather advisory writes are backend-only.

## First production settings document
For the first controlled deployment, create `weather_settings/main` with:
```json
{
  "autoPostEnabled": false,
  "scannerHealthy": true
}
```

## Roles
Volunteer:
- view admin dashboard
- view posting history
- run a manual scanner check

Admin:
- all volunteer capabilities
- pause/resume Full Auto Facebook posting
- manage settings
- retry a failed post through the callable backend

Existing BYDRRM user approval can continue to be managed in the current Studio.

## Safety behavior
The backend does not use AI to decide warning level or affected areas.

It will not auto-post when:
- PAGASA page cannot be fetched
- Bulacan is not present
- affected municipalities cannot be confidently extracted
- required issue metadata is missing enough to push parser confidence below 0.95
- an advisory key already exists
- auto-posting is paused
- Meta publishing fails

A failed/held record remains visible in the admin dashboard for audit.

## Test the design locally
Run any static server from `public/`, then open:
`/?demo=1`

The demo uses the Heavy Rainfall Warning No. 44 format from 10 August 2026 to preview the interface only. Production mode reads Firestore.
