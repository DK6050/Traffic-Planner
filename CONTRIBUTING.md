# Contributing

Thanks for your interest in improving Traffic Planner.

## Getting started
1. Fork the repository and clone your fork.
2. Install and run the frontend (see the README):
   ```bash
   cd traffic-app
   npm install
   npm start
   ```
3. Create a branch: `git checkout -b feature/my-change`.

## Before opening a pull request
- Run the tests: `npx ng test --watch=false --browsers=ChromeHeadless`
- Make sure the production build passes: `npm run build`
- Keep changes focused, and add or update tests for behaviour you change.
- Never commit secrets. `.env` is git-ignored; put new settings in `.env.example` without real values.

## Reporting bugs
Open an issue with the steps to reproduce, what you expected, what happened, your browser and OS, and any console errors.

## Code style
Follow `traffic-app/.editorconfig` (2-space indent, single quotes in TypeScript).
