import React, { createContext, useContext, useMemo, useState } from "react";

import { Divider, Flex, Grid, Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import {
  CategoricalBarChart,
  PieChart,
  SingleValue,
  TimeseriesChart,
  convertToTimeseries,
} from "@dynatrace/strato-components-preview/charts";
import { GaugeChart, MeterBarChart } from "@dynatrace/strato-components/charts";
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

const Q_TIMESERIES = `fetch logs
| filter log.source == "palo-alto-firewall"
| fieldsAdd is_blocked = paloalto.action != "allow"
| makeTimeseries allowed = countIf(NOT is_blocked),
                 blocked = countIf(is_blocked),
                 interval: 5m`;

const Q_HIGH_RISK_RATIO = `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action != "allow"
| summarize total_blocked = count(),
            high_risk_blocked = countIf(
              paloalto.dport == 3389
              OR paloalto.dport == 1433
              OR paloalto.dport == 3306
              OR paloalto.dport == 21
              OR paloalto.dport == 4444)
| fieldsAdd high_risk_pct = round(toDouble(high_risk_blocked) / toDouble(total_blocked) * 100, decimals: 1)`;

const Q_UNIQUE_THREATS = `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action != "allow"
| summarize unique_sources = countDistinct(paloalto.src),
            unique_destinations = countDistinct(paloalto.dst),
            total_blocks = count()`;

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
  <Heading level={3} style={{ marginBottom: 8 }}>
    {title}
  </Heading>
);

const QueryError = ({ message }: { message: string }) => (
  <Flex alignItems="center" gap={8} style={{ color: Colors.Text.Critical.Default }} padding={16}>
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

function prettifyHeader(name: string): string {
  const stripped = name.replace(/^(paloalto|log)\./, "");
  let pretty = stripped
    .replace(/[_.]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const renames: Record<string, string> = {
    "Src": "Source",
    "Dst": "Destination",
    "Dport": "Destination Port",
  };
  return renames[pretty] ?? pretty;
}

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

const SummaryKPIs = () => {
  const { data: summaryData, error: summaryError, isLoading: summaryLoading } = useFilteredDql(Q_SUMMARY);
  const rec = summaryData?.records?.[0];

  return (
    <Surface elevation="raised" padding={20}>
      <SectionHeader title="Traffic Summary" />
      {summaryLoading && <LoadingSpinner />}
      {summaryError && <QueryError message={summaryError.message} />}
      {rec && (
        <Flex gap={32} flexWrap="wrap" justifyContent="center">
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
    </Surface>
  );
};

const BlockRateGauge = () => {
  const { data, error, isLoading } = useFilteredDql(Q_SUMMARY);
  const rec = data?.records?.[0];
  const blockedPct = Number(rec?.["blocked_pct"] ?? 0);

  return (
    <Flex flexDirection="column">
      <SectionHeader title="Block Rate" />
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {rec && (
        <GaugeChart value={blockedPct} max={100} height={220}>
          <GaugeChart.ThresholdIndicator value={5} color={Colors.Charts.Categorical.Color04.Default} />
          <GaugeChart.ThresholdIndicator value={15} color={Colors.Charts.Categorical.Color07.Default} />
          <GaugeChart.ThresholdIndicator value={30} color={Colors.Text.Critical.Default} />
        </GaugeChart>
      )}
      <Paragraph style={{ textAlign: "center", marginTop: 4, opacity: 0.7 }}>
        % of traffic blocked by firewall rules
      </Paragraph>
    </Flex>
  );
};

const HighRiskThreatGauge = () => {
  const { data, error, isLoading } = useFilteredDql(Q_HIGH_RISK_RATIO);
  const rec = data?.records?.[0];
  const highRiskPct = Number(rec?.["high_risk_pct"] ?? 0);

  return (
    <Flex flexDirection="column">
      <SectionHeader title="High-Risk Port Exposure" />
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {rec && (
        <GaugeChart value={highRiskPct} max={100} height={220}>
          <GaugeChart.ThresholdIndicator value={10} color={Colors.Charts.Categorical.Color04.Default} />
          <GaugeChart.ThresholdIndicator value={25} color={Colors.Charts.Categorical.Color07.Default} />
          <GaugeChart.ThresholdIndicator value={50} color={Colors.Text.Critical.Default} />
        </GaugeChart>
      )}
      <Paragraph style={{ textAlign: "center", marginTop: 4, opacity: 0.7 }}>
        % of blocks targeting RDP, SQL, FTP ports
      </Paragraph>
    </Flex>
  );
};

const ThreatConcentrationMeter = () => {
  const { data, error, isLoading } = useFilteredDql(Q_UNIQUE_THREATS);
  const rec = data?.records?.[0];
  const uniqueSources = Number(rec?.["unique_sources"] ?? 0);
  const uniqueDestinations = Number(rec?.["unique_destinations"] ?? 0);
  const totalBlocks = Number(rec?.["total_blocks"] ?? 0);

  return (
    <Flex flexDirection="column">
      <SectionHeader title="Threat Concentration" />
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {rec && totalBlocks > 0 && (
        <Flex flexDirection="column" gap={12}>
          <MeterBarChart value={uniqueSources} max={totalBlocks} name="Unique Attacking Sources" color={Colors.Text.Critical.Default}>
            <MeterBarChart.Label>Unique Attacking Sources</MeterBarChart.Label>
            <MeterBarChart.Value>{uniqueSources.toLocaleString()}</MeterBarChart.Value>
          </MeterBarChart>
          <MeterBarChart value={uniqueDestinations} max={totalBlocks} name="Unique Targets" color={Colors.Charts.Categorical.Color07.Default}>
            <MeterBarChart.Label>Unique Targets</MeterBarChart.Label>
            <MeterBarChart.Value>{uniqueDestinations.toLocaleString()}</MeterBarChart.Value>
          </MeterBarChart>
          <Paragraph style={{ textAlign: "center", marginTop: 4, opacity: 0.7 }}>
            Unique IPs relative to {totalBlocks.toLocaleString()} total blocks
          </Paragraph>
        </Flex>
      )}
    </Flex>
  );
};

const OverviewTable = () => {
  const { data: tableData, error: tableError, isLoading: tableLoading } = useFilteredDql(Q_OVERVIEW);

  return (
    <Flex flexDirection="column">
      <SectionHeader title="All Firewall Logs — Overview" />
      {tableLoading && <LoadingSpinner />}
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
    </Flex>
  );
};

const BlockedByRuleChart = () => {
  const { data, error, isLoading } = useFilteredDql(Q_BLOCKED_BY_RULE);
  const chartData = toBarData(data?.records, "paloalto.rule", "block_count");
  return (
    <Flex flexDirection="column">
      <SectionHeader title="Blocked by Firewall Rule" />
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {chartData.length > 0 && (
        <CategoricalBarChart data={chartData} layout="horizontal" height={300} />
      )}
    </Flex>
  );
};

const BlockedByAppChart = () => {
  const { data, error, isLoading } = useFilteredDql(Q_BLOCKED_BY_APP);
  const pieData = toPieData(data?.records, "paloalto.app", "block_count");
  return (
    <Flex flexDirection="column">
      <SectionHeader title="Blocked by Application" />
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {pieData.slices.length > 0 && (
        <PieChart data={pieData} height={300}>
          <PieChart.Grouping threshold={{ type: "number-of-slices", value: 10 }} />
          <PieChart.Legend />
        </PieChart>
      )}
    </Flex>
  );
};

const BlockedByActionChart = () => {
  const { data, error, isLoading } = useFilteredDql(Q_BLOCKED_BY_ACTION);
  const pieData = toPieData(data?.records, "paloalto.action", "count");
  return (
    <Flex flexDirection="column">
      <SectionHeader title="Blocked by Action Type" />
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {pieData.slices.length > 0 && (
        <PieChart data={pieData} height={300}>
          <PieChart.Legend />
        </PieChart>
      )}
    </Flex>
  );
};

const TimeseriesSection = () => {
  const { data, error, isLoading } = useFilteredDql(Q_TIMESERIES);
  return (
    <Flex flexDirection="column">
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
    </Flex>
  );
};

const BandwidthChart = () => {
  const { data, error, isLoading } = useFilteredDql(Q_BANDWIDTH);
  const chartData = toBarData(data?.records, "paloalto.app", "total_bytes");
  return (
    <Flex flexDirection="column">
      <SectionHeader title="Bandwidth by Application (Allowed Sessions)" />
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {chartData.length > 0 && (
        <CategoricalBarChart data={chartData} layout="horizontal" height={300} />
      )}
    </Flex>
  );
};

// ─── Page ────────────────────────────────────────────────────────────────────

export const Dashboard = () => {
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);

  return (
    <SegmentsProvider>
      <TimeframeContext.Provider value={timeframe}>
        <Flex flexDirection="column" padding={32} gap={20}>
          {/* Header bar with title and filters */}
          <Surface elevation="raised" padding={16}>
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
          </Surface>

          {/* Summary KPIs — top-level metrics at a glance */}
          <SummaryKPIs />

          {/* Gauges row: security posture indicators */}
          <Grid gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap={16}>
            <Surface elevation="raised" padding={20}>
              <BlockRateGauge />
            </Surface>
            <Surface elevation="raised" padding={20}>
              <HighRiskThreatGauge />
            </Surface>
            <Surface elevation="raised" padding={20}>
              <ThreatConcentrationMeter />
            </Surface>
          </Grid>

          <Divider />

          {/* Timeseries chart — traffic trend */}
          <TimeseriesSection />

          <Divider />

          {/* Visual breakdowns: charts */}
          <Grid gridTemplateColumns="repeat(auto-fit, minmax(400px, 1fr))" gap={16}>
            <BlockedByRuleChart />
            <BandwidthChart />
          </Grid>

          <Grid gridTemplateColumns="repeat(auto-fit, minmax(400px, 1fr))" gap={16}>
            <BlockedByAppChart />
            <BlockedByActionChart />
          </Grid>

          <Divider />

          {/* Full log table at bottom */}
          <OverviewTable />
        </Flex>
      </TimeframeContext.Provider>
    </SegmentsProvider>
  );
};
