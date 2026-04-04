# Photoflow Web App

The Photoflow front end is a progressive web app (PWA) that serves as the authenticated browser interface for the Photoflow photo gallery. It can be installed on iOS or Android like a native app, or used in any modern browser.

The app connects to the Photoflow API to browse thumbnails, view photo metadata, and manage albums. Original photos are never proxied through the app or API — they live in the user's own S3-compatible storage bucket. The front end is purely for display and interaction.

## Stack

- **React** (TypeScript)
- **Vite** — build tooling
- **Tailwind CSS** — styling
- **Icons** — [Iconoir](https://iconoir.com/)

## Running locally

```bash
npm install
npm start
```
