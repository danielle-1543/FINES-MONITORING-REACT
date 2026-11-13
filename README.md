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
- `npm test` checks API response validation, HTTP errors, timeouts, cancellation, network failures, and payment-proof downloads.
- `npm run build` generates the production site in `dist`.
- `npm run preview` previews that build locally.

## Deployment

Build with `npm ci && npm run build` and publish `dist`. On Render, set `VITE_API_URL=https://fines-monitoring-api.onrender.com/api` in the frontend service before building. The shared API client routes all `/api` requests to that backend, including login, session refresh, student management, payments, and push identity. An origin without `/api` is also accepted. Without this variable, requests stay relative for the local Vite proxy. Configure the frontend host to serve the React application for client routes. Environment changes require a new frontend build.

Set public environment variables before building. Configure OneSignal for the deployed HTTPS origin and keep the frontend worker available at `/OneSignalSDKWorker.js`. Private PostHog reporting and OneSignal REST keys belong only on the PHP server.

### OneSignal 401 during registration

If the browser allows notifications but OneSignal `/apps/.../users` returns 401 for `login-user` or `create-subscription`, inspect the failed request's response body. Check **Settings > Keys & IDs > Identity Verification** in the matching OneSignal app. OneSignal currently documents Token Identity Verification as unsupported for Web SDK clients; enabling enforcement blocks their user and subscription requests. See [OneSignal Identity Verification](https://documentation.onesignal.com/docs/en/identity-verification). Use a web-compatible OneSignal app configuration. Keep `VITE_ONESIGNAL_APP_ID` and backend `ONESIGNAL_APP_ID` matched. Do not put a REST API key in the frontend to work around this error.

After correcting OneSignal settings, reload each browser before enabling again: failed SDK operations can remain pending for the page session. The settings panel times out registration/account linking and offers a reload instead of leaving the button on “Please wait…”.

Financial and attendance records remain in MySQL. PostHog supplies usage analytics through the admin API.

## Error handling

Deploy both the frontend and PHP API for the shared handlers. API framework exceptions, fatal errors, missing routes, and database errors return JSON with a failure status and a `request_id`. Search backend logs for that reference to diagnose the underlying problem; the client never receives SQL, stack traces, or file paths from these handlers. Run `php console/test_api_errors.php` in the backend to verify error responses without connecting to the database.

Requests time out after 45 seconds, including response-body reads. Writes are never retried automatically; after a timeout or connection failure, check whether a record was saved before submitting again. Browser cancellation remains silent. Malformed responses show an actionable message. React render failures provide a reload screen, unexpected asynchronous errors show a dismissible notice, and offline browsers show a connection notice. These handlers report failures; underlying database errors and OneSignal configuration still require correction.
