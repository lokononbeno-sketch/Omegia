# Ω OMEGIA

**One app. Two worlds. Infinite connections.**

OMEGIA is a member-only social and communication platform designed to bring together the social-network experience and private messaging in one installable application.

> Project status: early foundation / prototype. Authentication (Supabase Auth: sign-up, sign-in, password recovery) is connected. Messaging, media storage, calls and other production services are not yet implemented. The interface must never imply that these services are live before they are connected and tested.

## Product principles

- **Members only:** visitors must sign up or sign in before accessing the social application.
- **One connected experience:** social feed, profiles, stories, groups, messaging and calls belong to one coherent product.
- **Accessible visual design:** violet is the brand accent; the interface uses light surfaces, white, soft lavender and readable dark text. Black is not the dominant page background. A separate dark theme may be added later.
- **Mobile and desktop:** installable Progressive Web App (PWA), responsive on Android and computers.
- **Privacy and safety:** account security, privacy controls, blocking, reporting and moderation are core requirements.
- **Backups:** every meaningful milestone is committed to GitLab. Keep a second export/backup outside the primary repository.

## Planned product areas

1. Accounts, registration, sign-in, recovery and sessions.
2. Profiles, friends/following, requests and discovery.
3. News feed, text/photo/video posts, reactions, comments and sharing.
4. Stories and short-form video.
5. Groups, communities, pages and events.
6. Private and group messaging, attachments, voice notes and message controls.
7. Audio/video calls and group calls (WebRTC infrastructure required).
8. Notifications, search and activity.
9. Privacy, blocking, reporting, moderation and administration.
10. PWA installation, offline shell and cross-device experience.

## Current foundation

The first milestone is a responsive, branded PWA shell with a member sign-in / registration entry screen. Authentication is delegated to Supabase Auth (passwords are never stored in the browser). The Supabase *publishable* key in `app.js` is public by design, so every table must be protected with Row Level Security policies before any member data is added. The member area itself is not built yet.

## Repository structure

- `index.html` — application entry point
- `styles.css` — responsive visual system
- `app.js` — login page: Supabase sign-up, sign-in, password recovery, fingerprint/face lock screen, PWA install button
- `shared.js` — code shared by the pages (Supabase loader, error messages, fingerprint/face helpers)
- `home.html`, `home.css`, `home.js` — news feed: publish, like, comment, new members
- `supabase/migrations/` — SQL for the database (profiles, posts, likes, comments) with Row Level Security
- `manifest.webmanifest` — PWA metadata
- `sw.js` — service worker for the static application shell
- `assets/omega.svg` — OMEGIA Ω mark

## Run locally

Open `index.html` in a modern browser, or serve the repository with any static web server. Service workers require HTTPS or localhost.

## Roadmap

- [x] Establish project identity and responsive PWA shell
- [x] Select and configure the production backend (Supabase)
- [ ] Implement real registration, sign-in, recovery and authorization
- [x] Build feed, posts, comments and likes (text only)
- [ ] Build profile pages, photos and videos
- [ ] Build stories, groups and discovery
- [ ] Build private/group messaging and attachments
- [ ] Add notifications and presence
- [ ] Integrate audio/video calling infrastructure
- [ ] Add moderation, privacy controls and production security review
- [ ] Test installation on Android and desktop

## Development and safety

Never commit API keys, passwords, private tokens, service-role keys or real user data. Use environment variables and server-side secrets for future integrations. Keep the repository private if source confidentiality is required; public repositories expose their source code.

## Ownership

Created for the OMEGIA project by Beno Lokonon.
