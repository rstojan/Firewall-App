# Firewall App for Dynatrace

A Dynatrace Platform app for monitoring and analyzing Palo Alto PAN-OS firewall traffic logs. Built with React, TypeScript, and the Dynatrace Strato design system, it provides at-a-glance security posture gauges, visual traffic breakdowns, deep-dive analysis tables, and anomaly detection — all powered by DQL queries against log data ingested via syslog.

## Features

### Overview Dashboard
Real-time security posture and traffic visibility:
- **Summary KPIs** — total logs, allowed/blocked counts, allow/block rate percentages
- **Block Rate gauge** — circular gauge showing % of traffic blocked, with threshold indicators
- **High-Risk Port Exposure gauge** — % of blocks targeting RDP, SQL, FTP, and backdoor ports
- **Threat Concentration meters** — unique attacking sources and targets relative to total blocks, with numeric values
- **Timeseries chart** — blocked vs allowed traffic over time (5-minute intervals, area chart)
- **Visual breakdowns** — blocked by firewall rule (bar), bandwidth by application (bar), blocked by application (pie), blocked by action type (pie)
- **All Firewall Logs table** — latest 100 log entries with full session details
- Global timeframe selector and Dynatrace segment filtering

### Deep Analysis
Tabular deep-dive into firewall data with a left sidebar navigation (similar to the Kubernetes app's Recommendations layout):
- **Blocked Traffic** — recent blocked sessions with source, destination, app, rule, and zone details
- **Zone Pair Analysis** — traffic flow between zones with total/allowed/blocked counts and block rates
- **Top Blocked Sources** — top 20 attacking source IPs with block counts and target counts
- **Top Blocked Destinations** — top 20 targeted destination IPs with block counts and attacker counts
- **High-Risk Port Blocks** — blocked connections on RDP (3389), SQL Server (1433), MySQL (3306), FTP (21), and backdoor (4444) ports
- **Session End Reasons** — breakdown of how and why sessions were terminated, grouped by reason and action
- Timeframe selector and segment filtering

### Traffic Analyzer
IP address investigation tool for troubleshooting blocked traffic:
- Source and/or destination IP lookup
- Blocked traffic event table with full session details
- Block reason summary grouped by action, rule, and session end reason
- Configurable timeframe

### Firewall Logs
Full log exploration with a sidebar filter panel:
- 7 multi-select filter dropdowns (Action, App, Rule, From/To Zone, Session End Reason, Device)
- Filter options populated dynamically from log data
- Full log table with 13 columns, pagination, and resizable columns
- Timeframe selector

### Recommendations
Anomaly detection rules with persistent activation via Dynatrace App Settings:
- 18 pre-built detection rules across 5 categories (Traffic Anomalies, Source & Destination, Policy & Rules, High-Risk Ports, Session & Device)
- One-click activate/deactivate with state persisted to the Dynatrace App Settings API
- Each rule includes a DQL query, description, and recommended badge
- Category-level activate/deactivate all and accordion layout

### Expand Monitoring
Extension discovery modal accessible from the header:
- Browse firewall-related extensions (Palo Alto PAN-OS, Check Point Firewall, Cisco Firepower)
- In-modal detail view with overview and key capabilities for each extension
- Search filtering across extension names and descriptions
- Link to Dynatrace Hub for installation

### Add Logs (Ingestion Wizard)
Step-by-step setup guide for configuring Palo Alto log ingestion:
- ActiveGate setup instructions
- Syslog profile configuration
- Log forwarding setup
- Ingestion verification

## Tech Stack

- **Framework:** React 18 + TypeScript
- **UI:** Dynatrace Strato design system (`@dynatrace/strato-components`)
- **Charts:** `GaugeChart`, `MeterBarChart`, `TimeseriesChart`, `CategoricalBarChart`, `PieChart`, `SingleValue`
- **Data:** DQL queries via `@dynatrace-sdk/react-hooks`
- **Settings persistence:** `@dynatrace-sdk/client-app-settings-v2`
- **Navigation:** React Router v6, `@dynatrace-sdk/navigation`
- **Build:** Dynatrace App Toolkit (`dt-app`)

## Available Scripts

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
