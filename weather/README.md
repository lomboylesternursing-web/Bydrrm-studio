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
- Automatic live PAGASA Radar Mosaic/QPE timeline
- Official PAGASA Himawari enhanced infrared frames
- Layer modes: Radar Mosaic, Rain Rate, Infrared, and Combined
- Windy-inspired dark scientific interface and enhanced-IR legend styling
- Embedded official PAGASA/PANaHON radar viewer for direct source comparison
- Automatic refresh every 5 minutes
- Local multi-frame image loading retained as a manual fallback
- Adjustable frame opacity and manual geographic bounds calibration
- Timeline playback with previous/next controls
- Clean branded PNG export for the current frame
- Animated GIF export from up to 12 chronological frames
- BYDRRM logo, timestamp, layer label, legend and DOST-PAGASA source attribution on exports

### Live data sources and scientific labeling
The live radar timeline is the same `HybridTimeline` endpoint used by PAGASA's public radar/map JavaScript. Its current response exposes `rainfall_estimate` frames under the national Radar Quantitative Precipitation Estimation/QPE product; the current `reflectivity` array is empty. The BYDRRM page therefore labels the live radar as Radar Mosaic/QPE and does not falsely present it as dBZ reflectivity.

PAGASA's public map JavaScript also uses enhanced Himawari frames from the MeteoPilipinas/PAGASA satellite repository. BYDRRM preserves those source image colors rather than inventing an unverified cloud-top-temperature conversion. The interface uses a Windy-inspired visual treatment around the imagery, while the meteorological pixels remain from the official source.

A dedicated Firebase HTTPS function in `radar-functions/` proxies only allow-listed PAGASA/MeteoPilipinas image hosts. This avoids browser CORS/export problems and prevents the endpoint from becoming a general-purpose proxy.

Official map extents discovered from PAGASA's public JavaScript are used directly:
- Radar: west 115.969111093, south 3.80912641587, east 129.511990464, north 22.322581275
- Satellite: west 103.99541937000095, south -1.0593208520000024, east 147.02927158600028, north 30.014531363000003

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

Then deploy the Weather functions and isolated site:
```bash
cd functions
npm install
npm test
cd ../radar-functions
npm install
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
