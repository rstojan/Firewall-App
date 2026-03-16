import React, { createContext, useContext, useMemo, useState } from "react";

import { Divider, Flex, Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
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

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Section definitions ────────────────────────────────────────────────────

interface AnalysisSection {
  id: string;
  title: string;
}

const SECTIONS: AnalysisSection[] = [
  { id: "blocked-traffic", title: "Blocked Traffic" },
  { id: "zone-pairs", title: "Zone Pair Analysis" },
  { id: "top-sources", title: "Top Blocked Sources" },
  { id: "top-destinations", title: "Top Blocked Destinations" },
  { id: "high-risk-ports", title: "High-Risk Port Blocks" },
  { id: "session-reasons", title: "Session End Reasons" },
];

// ─── Table components ───────────────────────────────────────────────────────

const BlockedTable = () => {
  const { data, error, isLoading } = useFilteredDql(Q_BLOCKED);
  return (
    <Flex flexDirection="column" gap={8}>
      <Heading level={3}>Blocked Traffic</Heading>
      <Paragraph style={{ opacity: 0.7 }}>
        Recent sessions blocked by firewall policy. Shows the last 100 blocked events with source, destination, application, and rule details.
      </Paragraph>
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {data?.records && data.types && (
        <DataTable data={data.records} columns={prettyColumns(data.types)} resizable>
          <DataTable.Pagination defaultPageSize={15} />
        </DataTable>
      )}
    </Flex>
  );
};

const ZonePairTable = () => {
  const { data, error, isLoading } = useFilteredDql(Q_ZONE_PAIRS);
  return (
    <Flex flexDirection="column" gap={8}>
      <Heading level={3}>Zone Pair Analysis</Heading>
      <Paragraph style={{ opacity: 0.7 }}>
        Traffic flow between firewall zones with block rates. High block rates may indicate misconfigured policies or unexpected traffic patterns.
      </Paragraph>
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {data?.records && data.types && (
        <DataTable data={data.records} columns={prettyColumns(data.types)} resizable>
          <DataTable.Pagination defaultPageSize={15} />
        </DataTable>
      )}
    </Flex>
  );
};

const TopBlockedSrcTable = () => {
  const { data, error, isLoading } = useFilteredDql(Q_TOP_BLOCKED_SRC);
  return (
    <Flex flexDirection="column" gap={8}>
      <Heading level={3}>Top Blocked Sources</Heading>
      <Paragraph style={{ opacity: 0.7 }}>
        Top 20 source IPs generating the most blocked sessions. A high block count from a single source may indicate scanning or brute force activity.
      </Paragraph>
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {data?.records && data.types && (
        <DataTable data={data.records} columns={prettyColumns(data.types)} resizable>
          <DataTable.Pagination defaultPageSize={15} />
        </DataTable>
      )}
    </Flex>
  );
};

const TopBlockedDstTable = () => {
  const { data, error, isLoading } = useFilteredDql(Q_TOP_BLOCKED_DST);
  return (
    <Flex flexDirection="column" gap={8}>
      <Heading level={3}>Top Blocked Destinations</Heading>
      <Paragraph style={{ opacity: 0.7 }}>
        Top 20 destination IPs targeted by blocked traffic. High counts suggest services or hosts under active attack.
      </Paragraph>
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {data?.records && data.types && (
        <DataTable data={data.records} columns={prettyColumns(data.types)} resizable>
          <DataTable.Pagination defaultPageSize={15} />
        </DataTable>
      )}
    </Flex>
  );
};

const HighRiskTable = () => {
  const { data, error, isLoading } = useFilteredDql(Q_HIGH_RISK);
  return (
    <Flex flexDirection="column" gap={8}>
      <Heading level={3}>High-Risk Port Blocks (RDP / SQL / FTP)</Heading>
      <Paragraph style={{ opacity: 0.7 }}>
        Blocked connections targeting commonly exploited ports: RDP (3389), SQL Server (1433), MySQL (3306), FTP (21), and backdoor (4444).
      </Paragraph>
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {data?.records && data.types && (
        <DataTable data={data.records} columns={prettyColumns(data.types)} resizable>
          <DataTable.Pagination defaultPageSize={15} />
        </DataTable>
      )}
    </Flex>
  );
};

const SessionReasonsTable = () => {
  const { data, error, isLoading } = useFilteredDql(Q_SESSION_REASONS);
  return (
    <Flex flexDirection="column" gap={8}>
      <Heading level={3}>Session End Reason Breakdown</Heading>
      <Paragraph style={{ opacity: 0.7 }}>
        How and why sessions were terminated. Threat-related reasons (threat, policy-deny, decrypt-error) warrant close attention.
      </Paragraph>
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {data?.records && data.types && (
        <DataTable data={data.records} columns={prettyColumns(data.types)} resizable>
          <DataTable.Pagination defaultPageSize={15} />
        </DataTable>
      )}
    </Flex>
  );
};

const SECTION_COMPONENTS: Record<string, React.FC> = {
  "blocked-traffic": BlockedTable,
  "zone-pairs": ZonePairTable,
  "top-sources": TopBlockedSrcTable,
  "top-destinations": TopBlockedDstTable,
  "high-risk-ports": HighRiskTable,
  "session-reasons": SessionReasonsTable,
};

// ─── Page ────────────────────────────────────────────────────────────────────

export const DeepAnalysis = () => {
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);

  const ActiveComponent = SECTION_COMPONENTS[activeSection];

  return (
    <SegmentsProvider>
      <TimeframeContext.Provider value={timeframe}>
        <Flex flexDirection="column" padding={32} gap={20}>
          {/* Header bar */}
          <Surface elevation="raised" padding={16}>
            <Flex alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={16}>
              <Flex alignItems="center" gap={16}>
                <img
                  src="./assets/PaloAlto.png"
                  alt="Palo Alto Networks"
                  style={{ maxHeight: 48, maxWidth: 120, objectFit: "contain" }}
                />
                <Heading level={1}>Deep Analysis</Heading>
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

          {/* Sidebar + content layout */}
          <Flex gap={24} style={{ minHeight: 600 }}>
            {/* Left sidebar nav */}
            <Surface elevation="raised" style={{ minWidth: 240, flexShrink: 0, alignSelf: "flex-start" }}>
              <Flex flexDirection="column" padding={8}>
                {SECTIONS.map((section) => (
                  <div
                    key={section.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveSection(section.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setActiveSection(section.id);
                    }}
                    style={{
                      padding: "10px 16px",
                      cursor: "pointer",
                      borderRadius: 4,
                      fontSize: 14,
                      fontWeight: activeSection === section.id ? 600 : 400,
                      backgroundColor: activeSection === section.id
                        ? Colors.Background.Field.Primary.Default
                        : "transparent",
                      borderLeft: activeSection === section.id
                        ? `3px solid ${Colors.Border.Primary.Default}`
                        : "3px solid transparent",
                      transition: "background-color 0.15s, border-color 0.15s",
                    }}
                  >
                    {section.title}
                  </div>
                ))}
              </Flex>
            </Surface>

            {/* Main content area */}
            <Flex flexDirection="column" style={{ flex: 1, minWidth: 0 }} key={activeSection}>
              {ActiveComponent && <ActiveComponent />}
            </Flex>
          </Flex>
        </Flex>
      </TimeframeContext.Provider>
    </SegmentsProvider>
  );
};
