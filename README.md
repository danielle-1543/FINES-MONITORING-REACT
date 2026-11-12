# FINES Monitoring System — React frontend

React + Vite portal for administrators, organizations, and students.

## Local setup

1. Install Node.js and run `npm ci` in this directory.
2. Configure the PHP/MySQL backend using its README.
3. Run the backend at `http://127.0.0.1:3000`, or update the proxy target in `vite.config.js`.
4. Set optional browser configuration in `.env.local`:

```dotenv
VITE_POSTHOG_KEY=your_public_project_token
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_ONESIGNAL_APP_ID=your_public_app_id
```

Use the PostHog host for your project's region. Never put private API keys in `VITE_` variables: they are included in browser code. Restart Vite after environment changes.

Run `npm run dev`, then open `http://localhost:5174`. The fixed port matches the configured web push origin.

## Checks and build

- `npm run lint` checks JavaScript and React source.
- `npm run build` generates the production site in `dist`.
- `npm run preview` previews that build locally.

## Deployment

Build with `npm ci && npm run build` and publish `dist`. Configure the host to serve the React application for client routes and forward `/api` requests to the PHP backend. Vite's development proxy is not included in production.

Set public environment variables before building. Configure OneSignal for the deployed HTTPS origin and keep the frontend worker available at `/OneSignalSDKWorker.js`. Private PostHog reporting and OneSignal REST keys belong only on the PHP server.

Financial and attendance records remain in MySQL. PostHog supplies usage analytics through the admin API.
