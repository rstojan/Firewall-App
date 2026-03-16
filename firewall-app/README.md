# Firewall App for Dynatrace

A Dynatrace Platform app for monitoring and analyzing Palo Alto PAN-OS firewall traffic logs. Built with React, TypeScript, and the Dynatrace Strato design system.

## Features

### Overview Dashboard
Full-featured dashboard with real-time visibility into firewall activity:
- Summary metrics (total logs, allowed/blocked counts, allow/block rates)
- Blocked vs allowed traffic over time (timeseries chart)
- Blocked traffic breakdown by firewall rule, application, and action type
- Zone pair analysis with block rates
- Top blocked sources and destinations
- High-risk port blocks (RDP, SQL, FTP)
- Session end reason breakdown
- Bandwidth by application
- Timeframe selector and segment filtering

### Traffic Analyzer
IP address investigation tool for troubleshooting blocked traffic:
- Source and/or destination IP lookup
- Blocked traffic event table with full session details
- Block reason summary grouped by action, rule, and session end reason
- Configurable timeframe

### Firewall Logs
Log exploration page with a sidebar filter panel:
- 7 multi-select filter dropdowns (Action, App, Rule, From/To Zone, Session End Reason, Device)
- Filter options populated dynamically from log data
- Full log table with 13 columns, pagination, and resizable columns
- Timeframe selector

### Recommendations
Anomaly detection rules with persistent activation via Dynatrace App Settings:
- 18 pre-built detection rules across 5 categories (Traffic Anomalies, Source Behavior, Policy & Compliance, High-Risk Activity, Session Anomalies)
- One-click activate/deactivate with state persisted to the Dynatrace App Settings API
- Each rule includes a DQL query, description, and recommended badge
- Category-based accordion layout with expand/collapse all

### Expand Monitoring
Extension discovery modal accessible from the header:
- Browse firewall-related extensions (Palo Alto PAN-OS, Check Point Firewall, Cisco Firepower)
- Extension details fetched dynamically from the Dynatrace Hub API (logos, screenshots, descriptions)
- In-modal detail view with screenshot carousel and "Add to environment" button
- Search filtering

### Add Logs (Ingestion Wizard)
Step-by-step setup guide for configuring Palo Alto log ingestion:
- ActiveGate setup instructions
- Syslog profile configuration
- Log forwarding setup
- Ingestion verification

## Tech Stack

- **Framework:** React 18 + TypeScript
- **UI:** Dynatrace Strato design system (`@dynatrace/strato-components`)
- **Data:** DQL queries via `@dynatrace-sdk/react-hooks`
- **Settings persistence:** `@dynatrace-sdk/client-app-settings-v2`
- **Hub integration:** `@dynatrace-sdk/http-client`
- **Navigation:** React Router v6
- **Build:** Dynatrace App Toolkit (`dt-app`)

## Available Scripts

In the project directory, you can run:

### `npm run start`

Runs the app in development mode. A new browser window with your running app will be automatically opened.

### `npm run build`

Builds the app for production to the `dist` folder.

### `npm run deploy`

Builds the app and deploys it to the specified environment in `app.config.json`.

### `npm run uninstall`

Uninstalls the app from the specified environment in `app.config.json`.

## Learn more

- [Dynatrace Developer](https://dt-url.net/developers) - Platform documentation
- [React documentation](https://reactjs.org/)
