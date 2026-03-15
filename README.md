# Palo Alto Firewall Log Analyzer

A Dynatrace AppEngine application for analyzing Palo Alto Networks PAN-OS firewall traffic logs ingested into Dynatrace Grail.

## Overview

This app provides visibility into firewall activity by querying structured `paloalto.*` log attributes stored in Grail. It is designed to help security and network teams quickly understand traffic patterns, identify blocked sessions, investigate specific IP pairs, and monitor high-risk port activity — all within the Dynatrace platform.

Logs are expected to be ingested with `log.source == "palo-alto-firewall"` and structured fields produced by the **Palo Alto Firewall Log Generator** Dynatrace workflow, which generates a realistic mix of allowed and blocked traffic across multiple applications, network zones, and firewall rules.

## Features

### Firewall Dashboard

A full analytics dashboard covering:

- **Traffic Summary** — Total log count with allowed vs. blocked counts and percentages
- **All Firewall Logs** — Paginated table of recent log entries with key fields
- **Blocked Traffic** — Filtered view of denied and dropped sessions
- **Blocked by Firewall Rule** — Horizontal bar chart showing which rules trigger the most blocks
- **Blocked by Application** — Pie chart of blocked traffic broken down by application
- **Blocked by Action Type** — Pie chart of deny/drop/reset action distribution
- **Zone Pair Analysis** — Table of source/destination zone combinations with block rates
- **Top Blocked Sources** — Top 20 source IPs generating blocked traffic
- **Top Blocked Destinations** — Top 20 destination IPs receiving blocked traffic
- **Traffic Over Time** — Line chart of allowed vs. blocked sessions in 5-minute intervals
- **High-Risk Port Blocks** — Blocked sessions targeting RDP (3389), MSSQL (1433), MySQL (3306), FTP (21), and suspicious port 4444
- **Session End Reason Breakdown** — Table of session end reasons (policy-deny, threat, tcp-fin, etc.) by action
- **Bandwidth by Application** — Horizontal bar chart of total bytes transferred per application for allowed sessions

### Traffic Analyzer

An IP-based investigation tool that lets you enter a source IP, destination IP, or both to:

- Determine whether traffic between those addresses is being blocked
- See every blocked session with the firewall rule, action, zone, application, and session end reason
- Review a summary of block reasons grouped by action, rule, and session end reason

## Project Structure

```
firewall-app/
├── app.config.json          # App metadata, environment URL, and required scopes
├── ui/
│   ├── main.tsx
│   └── app/
│       ├── App.tsx          # Route definitions
│       ├── components/
│       │   ├── Header.tsx   # Navigation bar
│       │   └── Card.tsx     # Home page card component
│       └── pages/
│           ├── Home.tsx         # Landing page
│           ├── Dashboard.tsx    # Firewall analytics dashboard
│           └── TrafficAnalyzer.tsx  # IP-based traffic investigation
```

## DQL Queries

All queries filter on `log.source == "palo-alto-firewall"` and use the following structured log attributes:

| Attribute | Description |
|---|---|
| `paloalto.action` | Firewall action: `allow`, `deny`, `drop`, `reset-both` |
| `paloalto.src` | Source IP address |
| `paloalto.dst` | Destination IP address |
| `paloalto.app` | Application identified by the firewall |
| `paloalto.rule` | Firewall rule name that matched the session |
| `paloalto.from_zone` | Source security zone |
| `paloalto.to_zone` | Destination security zone |
| `paloalto.dport` | Destination port |
| `paloalto.bytes_sent` | Bytes sent in the session |
| `paloalto.bytes_received` | Bytes received in the session |
| `paloalto.session_end_reason` | Reason the session ended |
| `paloalto.device_name` | Name of the firewall device |

## Prerequisites

- Access to a Dynatrace environment with Grail enabled
- Palo Alto firewall logs ingested into Grail with the `paloalto.*` attribute schema
- Node.js >= 16.13.0

## Getting Started

```bash
cd firewall-app
npm install
npm run start     # local dev server with hot reload
```

## Deployment

Update `environmentUrl` in `app.config.json` to point to your Dynatrace environment, then:

```bash
npm run build     # build for production
npm run deploy    # deploy to the configured environment
```

> **Note:** Each deployment requires a unique version number. Increment the `version` field in `app.config.json` before redeploying if the bundle content has changed.

## Required Scopes

The following scopes must be listed in `app.config.json` under `scopes`:

| Scope | Purpose |
|---|---|
| `storage:logs:read` | Read firewall logs from Grail |
| `storage:buckets:read` | Access Grail storage buckets |
