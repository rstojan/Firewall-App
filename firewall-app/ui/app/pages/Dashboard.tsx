import React, { createContext, useContext, useMemo, useState } from "react";

import { Flex, Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import {
  CategoricalBarChart,
  PieChart,
  SingleValue,
  TimeseriesChart,
  convertToTimeseries,
} from "@dynatrace/strato-components-preview/charts";
import { DataTable, convertToColumns } from "@dynatrace/strato-components-preview/tables";
import {
  TimeframeSelector,
  SegmentSelector,
  SegmentsProvider,
  useSegments,
} from "@dynatrace/strato-components/filters";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { CriticalIcon } from "@dynatrace/strato-icons";
import { useDql } from "@dynatrace-sdk/react-hooks";

import type { Timeframe } from "@dynatrace/strato-components/core";
import type { FilterSegment } from "@dynatrace-sdk/client-query";

// ─── Dashboard filter context ────────────────────────────────────────────────

const DEFAULT_TIMEFRAME: Timeframe = {
  from: { absoluteDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), value: "now()-2h", type: "expression" },
  to: { absoluteDate: new Date().toISOString(), value: "now()", type: "expression" },
};

const TimeframeContext = createContext<Timeframe>(DEFAULT_TIMEFRAME);

/** Wraps useDql to automatically apply the dashboard timeframe and segment filters. */
function useFilteredDql(query: string) {
  const timeframe = useContext(TimeframeContext);
  const { segments } = useSegments();

  const params = useMemo(() => {
    return {
      query,
      defaultTimeframeStart: timeframe.from.absoluteDate,
      defaultTimeframeEnd: timeframe.to.absoluteDate,
      filterSegments: segments.length > 0 ? (segments as FilterSegment[]) : undefined,
    };
  }, [query, timeframe, segments]);

  return useDql(params);
}

// ─── Queries ────────────────────────────────────────────────────────────────

const Q_SUMMARY = `fetch logs
| filter log.source == "palo-alto-firewall"
| fieldsAdd is_blocked = paloalto.action != "allow"
| summarize total = count(),
            allowed = countIf(NOT is_blocked),
            blocked = countIf(is_blocked)
| fieldsAdd allowed_pct = round(toDouble(allowed) / toDouble(total) * 100, decimals: 1),
            blocked_pct = round(toDouble(blocked) / toDouble(total) * 100, decimals: 1)`;

const Q_OVERVIEW = `fetch logs
| filter log.source == "palo-alto-firewall"
| fields timestamp,
         paloalto.action,
         paloalto.src,
         paloalto.dst,
         paloalto.app,
         paloalto.rule,
         paloalto.from_zone,
         paloalto.to_zone,
         paloalto.dport,
         paloalto.bytes_sent,
         paloalto.bytes_received,
         paloalto.session_end_reason,
         paloalto.device_name
| sort timestamp desc
| limit 100`;

const Q_BLOCKED = `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action != "allow"
| fields timestamp,
         paloalto.action,
         paloalto.src,
         paloalto.dst,
         paloalto.app,
         paloalto.rule,
         paloalto.dport,
         paloalto.from_zone,
         paloalto.to_zone,
         paloalto.session_end_reason
| sort timestamp desc
| limit 100`;

const Q_BLOCKED_BY_RULE = `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action != "allow"
| summarize block_count = count(),
            unique_sources = countDistinct(paloalto.src),
            unique_apps = countDistinct(paloalto.app),
            by: { paloalto.rule }
| sort block_count desc`;

const Q_BLOCKED_BY_APP = `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action != "allow"
| summarize block_count = count(),
            by: { paloalto.app }
| sort block_count desc`;

const Q_BLOCKED_BY_ACTION = `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action != "allow"
| summarize count = count(),
            by: { paloalto.action }
| sort count desc`;

const Q_ZONE_PAIRS = `fetch logs
| filter log.source == "palo-alto-firewall"
| summarize total = count(),
            allowed = countIf(paloalto.action == "allow"),
            blocked = countIf(paloalto.action != "allow"),
            by: { paloalto.from_zone, paloalto.to_zone }
| fieldsAdd block_rate = round(toDouble(blocked) / toDouble(total) * 100, decimals: 1)
| sort block_rate desc`;

const Q_TOP_BLOCKED_DST = `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action != "allow"
| summarize block_count = count(),
            attacking_sources = countDistinct(paloalto.src),
            by: { paloalto.dst }
| sort block_count desc
| limit 20`;

const Q_TOP_BLOCKED_SRC = `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action != "allow"
| summarize block_count = count(),
            targets = countDistinct(paloalto.dst),
            by: { paloalto.src }
| sort block_count desc
| limit 20`;

const Q_TIMESERIES = `fetch logs
| filter log.source == "palo-alto-firewall"
| fieldsAdd is_blocked = paloalto.action != "allow"
| makeTimeseries allowed = countIf(NOT is_blocked),
                 blocked = countIf(is_blocked),
                 interval: 5m`;

const Q_HIGH_RISK = `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action != "allow"
| filter paloalto.dport == 3389
     OR paloalto.dport == 1433
     OR paloalto.dport == 3306
     OR paloalto.dport == 21
     OR paloalto.dport == 4444
| fields timestamp,
         paloalto.src,
         paloalto.dst,
         paloalto.dport,
         paloalto.app,
         paloalto.action,
         paloalto.rule,
         paloalto.session_end_reason
| sort timestamp desc`;

const Q_SESSION_REASONS = `fetch logs
| filter log.source == "palo-alto-firewall"
| summarize count = count(),
            by: { paloalto.session_end_reason, paloalto.action }
| sort count desc`;

const Q_BANDWIDTH = `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action == "allow"
| summarize total_bytes_sent = sum(paloalto.bytes_sent),
            total_bytes_received = sum(paloalto.bytes_received),
            session_count = count(),
            by: { paloalto.app }
| fieldsAdd total_bytes = total_bytes_sent + total_bytes_received
| sort total_bytes desc`;

// ─── Sub-components ──────────────────────────────────────────────────────────

const SectionHeader = ({ title }: { title: string }) => (
  <Heading level={3} style={{ marginBottom: 8, marginTop: 24 }}>
    {title}
  </Heading>
);

const QueryError = ({ message }: { message: string }) => (
  <Flex alignItems="center" gap={8} style={{ color: Colors.Text.Critical.Default, padding: 16 }}>
    <CriticalIcon />
    <Paragraph>{message}</Paragraph>
  </Flex>
);

const LoadingSpinner = () => (
  <Flex justifyContent="center" alignItems="center" style={{ minHeight: 120 }}>
    <ProgressCircle />
  </Flex>
);

// ─── Chart helpers ───────────────────────────────────────────────────────────

function toBarData(records: Record<string, unknown>[] | null | undefined, categoryKey: string, valueKey: string) {
  if (!records) return [];
  return records
    .filter((r) => r[categoryKey] != null && r[valueKey] != null)
    .map((r) => ({
      category: String(r[categoryKey]),
      value: Number(r[valueKey]),
    }));
}

function toPieData(records: Record<string, unknown>[] | null | undefined, categoryKey: string, valueKey: string) {
  if (!records) return { slices: [] };
  return {
    slices: records
      .filter((r) => r[categoryKey] != null && r[valueKey] != null)
      .map((r) => ({
        category: String(r[categoryKey]),
        value: Number(r[valueKey]),
      })),
  };
}

/** Convert a DQL field name like "paloalto.session_end_reason" → "Session End Reason". */
function prettifyHeader(name: string): string {
  // Strip known prefixes
  const stripped = name.replace(/^(paloalto|log)\./, "");
  // Replace underscores and dots with spaces, then title-case each word
  let pretty = stripped
    .replace(/[_.]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  // Friendly renames
  const renames: Record<string, string> = {
    "Src": "Source",
    "Dst": "Destination",
    "Dport": "Destination Port",
  };
  return renames[pretty] ?? pretty;
}

/** Wraps convertToColumns and applies prettified headers. */
function prettyColumns(types: Parameters<typeof convertToColumns>[0]) {
  const cols = convertToColumns(types);
  for (const col of cols) {
    if (typeof col.header === "string") {
      col.header = prettifyHeader(col.header);
    }
  }
  return cols;
}

// ─── Section components ──────────────────────────────────────────────────────

const OverviewSection = () => {
  const { data: summaryData, error: summaryError, isLoading: summaryLoading } = useFilteredDql(Q_SUMMARY);
  const { data: tableData, error: tableError, isLoading: tableLoading } = useFilteredDql(Q_OVERVIEW);
  const rec = summaryData?.records?.[0];

  return (
    <Surface style={{ padding: 24 }}>
      <SectionHeader title="All Firewall Logs — Overview" />
      {(summaryLoading || tableLoading) && <LoadingSpinner />}
      {summaryError && <QueryError message={summaryError.message} />}
      {rec && (
        <Flex gap={32} flexWrap="wrap" style={{ marginBottom: 16 }}>
          <SingleValue
            data={Number(rec["total"] ?? 0)}
            label="Total Logs"
          />
          <SingleValue
            data={Number(rec["allowed"] ?? 0)}
            label="Allowed"
            color={Colors.Charts.Categorical.Color04.Default}
          />
          <SingleValue
            data={Number(rec["blocked"] ?? 0)}
            label="Blocked"
            color={Colors.Text.Critical.Default}
          />
          <SingleValue
            data={String(rec["allowed_pct"] ?? 0) + "%"}
            label="Allow Rate"
          />
          <SingleValue
            data={String(rec["blocked_pct"] ?? 0) + "%"}
            label="Block Rate"
            color={Colors.Text.Critical.Default}
          />
        </Flex>
      )}
      {tableError && <QueryError message={tableError.message} />}
      {tableData?.records && tableData.types && (
        <DataTable
          data={tableData.records}
          columns={prettyColumns(tableData.types)}
          resizable
        >
          <DataTable.Pagination defaultPageSize={10} />
        </DataTable>
      )}
    </Surface>
  );
};

const BlockedTable = () => {
  const { data, error, isLoading } = useFilteredDql(Q_BLOCKED);
  return (
    <Surface style={{ padding: 24 }}>
      <SectionHeader title="Blocked Traffic Only" />
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {data?.records && data.types && (
        <DataTable
          data={data.records}
          columns={prettyColumns(data.types)}
          resizable
        >
          <DataTable.Pagination defaultPageSize={10} />
        </DataTable>
      )}
    </Surface>
  );
};

const BlockedByRuleChart = () => {
  const { data, error, isLoading } = useFilteredDql(Q_BLOCKED_BY_RULE);
  const chartData = toBarData(data?.records, "paloalto.rule", "block_count");
  return (
    <Surface style={{ padding: 24, flex: 1 }}>
      <SectionHeader title="Blocked by Firewall Rule" />
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {chartData.length > 0 && (
        <CategoricalBarChart data={chartData} layout="horizontal" height={300} />
      )}
    </Surface>
  );
};

const BlockedByAppChart = () => {
  const { data, error, isLoading } = useFilteredDql(Q_BLOCKED_BY_APP);
  const pieData = toPieData(data?.records, "paloalto.app", "block_count");
  return (
    <Surface style={{ padding: 24, flex: 1 }}>
      <SectionHeader title="Blocked by Application" />
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {pieData.slices.length > 0 && (
        <PieChart data={pieData} height={300}>
          <PieChart.Grouping threshold={{ type: "number-of-slices", value: 10 }} />
          <PieChart.Legend />
        </PieChart>
      )}
    </Surface>
  );
};

const BlockedByActionChart = () => {
  const { data, error, isLoading } = useFilteredDql(Q_BLOCKED_BY_ACTION);
  const pieData = toPieData(data?.records, "paloalto.action", "count");
  return (
    <Surface style={{ padding: 24, flex: 1 }}>
      <SectionHeader title="Blocked by Action Type" />
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {pieData.slices.length > 0 && (
        <PieChart data={pieData} height={300}>
          <PieChart.Legend />
        </PieChart>
      )}
    </Surface>
  );
};

const ZonePairTable = () => {
  const { data, error, isLoading } = useFilteredDql(Q_ZONE_PAIRS);
  return (
    <Surface style={{ padding: 24, flex: 1 }}>
      <SectionHeader title="Zone Pair Analysis" />
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {data?.records && data.types && (
        <DataTable
          data={data.records}
          columns={prettyColumns(data.types)}
          resizable
        >
          <DataTable.Pagination defaultPageSize={10} />
        </DataTable>
      )}
    </Surface>
  );
};

const TopBlockedDstTable = () => {
  const { data, error, isLoading } = useFilteredDql(Q_TOP_BLOCKED_DST);
  return (
    <Surface style={{ padding: 24, flex: 1 }}>
      <SectionHeader title="Top Blocked Destinations" />
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {data?.records && data.types && (
        <DataTable
          data={data.records}
          columns={prettyColumns(data.types)}
          resizable
        >
          <DataTable.Pagination defaultPageSize={10} />
        </DataTable>
      )}
    </Surface>
  );
};

const TopBlockedSrcTable = () => {
  const { data, error, isLoading } = useFilteredDql(Q_TOP_BLOCKED_SRC);
  return (
    <Surface style={{ padding: 24, flex: 1 }}>
      <SectionHeader title="Top Blocked Sources" />
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {data?.records && data.types && (
        <DataTable
          data={data.records}
          columns={prettyColumns(data.types)}
          resizable
        >
          <DataTable.Pagination defaultPageSize={10} />
        </DataTable>
      )}
    </Surface>
  );
};

const TimeseriesSection = () => {
  const { data, error, isLoading } = useFilteredDql(Q_TIMESERIES);
  return (
    <Surface style={{ padding: 24 }}>
      <SectionHeader title="Blocked vs Allowed Traffic Over Time" />
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {data?.records && data.types && (
        <TimeseriesChart
          data={convertToTimeseries(data.records, data.types)}
          gapPolicy="connect"
          variant="area"
          height={280}
        />
      )}
    </Surface>
  );
};

const HighRiskTable = () => {
  const { data, error, isLoading } = useFilteredDql(Q_HIGH_RISK);
  return (
    <Surface style={{ padding: 24 }}>
      <SectionHeader title="High-Risk Port Blocks (RDP/SQL/FTP)" />
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {data?.records && data.types && (
        <DataTable
          data={data.records}
          columns={prettyColumns(data.types)}
          resizable
        >
          <DataTable.Pagination defaultPageSize={10} />
        </DataTable>
      )}
    </Surface>
  );
};

const SessionReasonsTable = () => {
  const { data, error, isLoading } = useFilteredDql(Q_SESSION_REASONS);
  return (
    <Surface style={{ padding: 24, flex: 1 }}>
      <SectionHeader title="Session End Reason Breakdown" />
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {data?.records && data.types && (
        <DataTable
          data={data.records}
          columns={prettyColumns(data.types)}
          resizable
        >
          <DataTable.Pagination defaultPageSize={10} />
        </DataTable>
      )}
    </Surface>
  );
};

const BandwidthChart = () => {
  const { data, error, isLoading } = useFilteredDql(Q_BANDWIDTH);
  const chartData = toBarData(data?.records, "paloalto.app", "total_bytes");
  return (
    <Surface style={{ padding: 24, flex: 1 }}>
      <SectionHeader title="Bandwidth by Application (Allowed Sessions)" />
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {chartData.length > 0 && (
        <CategoricalBarChart data={chartData} layout="horizontal" height={300} />
      )}
    </Surface>
  );
};

// ─── Page ────────────────────────────────────────────────────────────────────

export const Dashboard = () => {
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);

  return (
    <SegmentsProvider>
      <TimeframeContext.Provider value={timeframe}>
        <Flex flexDirection="column" padding={32} gap={16}>
          <Flex alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={16}>
            <Flex alignItems="center" gap={16}>
              <img
                src="./assets/PaloAlto.png"
                alt="Palo Alto Networks"
                style={{ maxHeight: 48, maxWidth: 120, objectFit: "contain" }}
              />
              <Heading level={1}>Palo Alto Firewall Log Analysis</Heading>
            </Flex>
            <Flex gap={16} flexWrap="wrap" alignItems="center">
              <TimeframeSelector
                value={timeframe}
                onChange={(value) => { if (value) setTimeframe(value); }}
              />
              <SegmentSelector />
            </Flex>
          </Flex>

          <TimeseriesSection />

          <BlockedTable />

          <Flex gap={16} flexWrap="wrap">
            <BlockedByRuleChart />
            <BlockedByAppChart />
          </Flex>

          <Flex gap={16} flexWrap="wrap">
            <BlockedByActionChart />
            <ZonePairTable />
          </Flex>

          <Flex gap={16} flexWrap="wrap">
            <TopBlockedSrcTable />
            <TopBlockedDstTable />
          </Flex>

          <HighRiskTable />

          <Flex gap={16} flexWrap="wrap">
            <SessionReasonsTable />
            <BandwidthChart />
          </Flex>

          <OverviewSection />
        </Flex>
      </TimeframeContext.Provider>
    </SegmentsProvider>
  );
};
