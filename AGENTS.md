# Agent Guidelines

## Project context

Photoflow is a self-hosted photo gallery — a privacy-focused alternative to Apple iCloud Photos and Google Photos. Users connect their own S3-compatible storage bucket; Photoflow reads from that bucket to generate thumbnails, index EXIF metadata, and serve an authenticated API. Original photos are never stored or proxied by the app.

This repo is the front end: a React PWA (TypeScript, Vite, Tailwind) that provides the authenticated gallery interface. It can be installed on a phone like a native app or accessed in any browser. It communicates exclusively with the Photoflow API. It only accesses S3 via <img> and <video> tags to display user content.

## Coding guidelines

Prioritise readability and long-term maintainability over cleverness or brevity.

- Avoid unnecessary complexity. If a simpler approach works, use it.
- Don't add abstractions, utilities, or helpers unless they're used in more than one place.
- Don't add error handling, validation, or fallbacks for scenarios that can't happen.
- Use comments to explain the *intent* of code blocks that aren't immediately obvious — not to restate what the code does.
- Don't add comments, docstrings, or type annotations to code you didn't change.
- Match the style and conventions of the surrounding code.
