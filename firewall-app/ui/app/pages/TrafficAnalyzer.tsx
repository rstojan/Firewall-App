import React, { useState } from "react";

import { Flex, Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Strong } from "@dynatrace/strato-components/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { TextInput } from "@dynatrace/strato-components-preview/forms";
import { TimeframeSelector } from "@dynatrace/strato-components-preview/filters";
import { DataTable, convertToColumns } from "@dynatrace/strato-components-preview/tables";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { CriticalIcon, SuccessIcon } from "@dynatrace/strato-icons";
import { useDql } from "@dynatrace-sdk/react-hooks";

import type { Timeframe } from "@dynatrace/strato-components/core";

// ─── Column helpers ──────────────────────────────────────────────────────────

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

// ─── Types ───────────────────────────────────────────────────────────────────

interface QueryParams {
  src: string;
  dst: string;
  timeframe: Timeframe;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_TIMEFRAME: Timeframe = {
  from: { absoluteDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), value: "now()-2h", type: "expression" },
  to: { absoluteDate: new Date().toISOString(), value: "now()", type: "expression" },
};

// ─── Query builder ───────────────────────────────────────────────────────────

function timeframeClause(tf: Timeframe): string {
  const from = tf.from.type === "expression" ? tf.from.value : `"${tf.from.value}"`;
  const to = tf.to.type === "expression" ? tf.to.value : `"${tf.to.value}"`;
  return `, from: ${from}, to: ${to}`;
}

function buildBlockedQuery(src: string, dst: string, tf: Timeframe): string {
  const conditions: string[] = ['log.source == "palo-alto-firewall"', 'paloalto.action != "allow"'];
  if (src) conditions.push(`paloalto.src == "${src}"`);
  if (dst) conditions.push(`paloalto.dst == "${dst}"`);

  return `fetch logs${timeframeClause(tf)}
| filter ${conditions.join("\n         AND ")}
| fields timestamp,
         paloalto.action,
         paloalto.src,
         paloalto.dst,
         paloalto.app,
         paloalto.rule,
         paloalto.dport,
         paloalto.from_zone,
         paloalto.to_zone,
         paloalto.session_end_reason,
         paloalto.device_name
| sort timestamp desc
| limit 200`;
}

function buildAllTrafficQuery(src: string, dst: string, tf: Timeframe): string {
  const conditions: string[] = ['log.source == "palo-alto-firewall"'];
  if (src) conditions.push(`paloalto.src == "${src}"`);
  if (dst) conditions.push(`paloalto.dst == "${dst}"`);

  return `fetch logs${timeframeClause(tf)}
| filter ${conditions.join("\n         AND ")}
| fieldsAdd is_blocked = paloalto.action != "allow"
| summarize total = count(),
            allowed = countIf(NOT is_blocked),
            blocked = countIf(is_blocked),
            by: { paloalto.action, paloalto.rule, paloalto.session_end_reason }
| sort blocked desc`;
}

// ─── Result components ───────────────────────────────────────────────────────

const BlockedResults = ({ params }: { params: QueryParams }) => {
  const query = buildBlockedQuery(params.src, params.dst, params.timeframe);
  const { data, error, isLoading } = useDql({ query });

  if (isLoading) {
    return (
      <Flex justifyContent="center" alignItems="center" style={{ minHeight: 120 }}>
        <ProgressCircle />
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex alignItems="center" gap={8} style={{ color: Colors.Text.Critical.Default, padding: 16 }}>
        <CriticalIcon />
        <Paragraph>{error.message}</Paragraph>
      </Flex>
    );
  }

  const count = data?.records?.length ?? 0;

  return (
    <Flex flexDirection="column" gap={16}>
      <Flex alignItems="center" gap={12}>
        {count === 0 ? (
          <>
            <SuccessIcon style={{ color: Colors.Text.Success.Default }} />
            <Paragraph>
              <Strong>No blocked traffic found</Strong> for the specified IPs in the selected timeframe.
            </Paragraph>
          </>
        ) : (
          <>
            <CriticalIcon style={{ color: Colors.Text.Critical.Default }} />
            <Paragraph style={{ color: Colors.Text.Critical.Default }}>
              <Strong>{count} blocked event{count !== 1 ? "s" : ""} found</Strong>
            </Paragraph>
          </>
        )}
      </Flex>

      {count > 0 && data?.records && data.types && (
        <DataTable
          data={data.records}
          columns={prettyColumns(data.types)}
          resizable
        >
          <DataTable.Pagination defaultPageSize={25} />
        </DataTable>
      )}
    </Flex>
  );
};

const BlockReasonSummary = ({ params }: { params: QueryParams }) => {
  const query = buildAllTrafficQuery(params.src, params.dst, params.timeframe);
  const { data, error, isLoading } = useDql({ query });

  if (isLoading || error || !data?.records?.length) return null;

  return (
    <Surface style={{ padding: 24 }}>
      <Heading level={3} style={{ marginBottom: 12 }}>
        Block Reason Summary
      </Heading>
      <Paragraph style={{ marginBottom: 12 }}>
        Traffic breakdown by action, firewall rule, and session end reason:
      </Paragraph>
      {data.types && (
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

// ─── Page ────────────────────────────────────────────────────────────────────

export const TrafficAnalyzer = () => {
  const [srcInput, setSrcInput] = useState("");
  const [dstInput, setDstInput] = useState("");
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);
  const [activeParams, setActiveParams] = useState<QueryParams | null>(null);

  const canSearch = srcInput.trim() !== "" || dstInput.trim() !== "";

  function handleSearch() {
    if (!canSearch) return;
    setActiveParams({ src: srcInput.trim(), dst: dstInput.trim(), timeframe });
  }

  function handleClear() {
    setSrcInput("");
    setDstInput("");
    setActiveParams(null);
  }

  return (
    <Flex flexDirection="column" padding={32} gap={24}>
      <Heading level={1}>Traffic Analyzer</Heading>
      <Paragraph>
        Enter a source IP, destination IP, or both to investigate whether traffic is being blocked
        and understand why.
      </Paragraph>

      <Surface style={{ padding: 24 }}>
        <Heading level={3} style={{ marginBottom: 16 }}>
          IP Address Lookup
        </Heading>
        <Flex gap={16} flexWrap="wrap" alignItems="flex-end">
          <Flex flexDirection="column" gap={4} style={{ minWidth: 240 }}>
            <Paragraph>
              <Strong>Source IP</Strong>
            </Paragraph>
            <TextInput
              value={srcInput}
              onChange={(val) => setSrcInput(val ?? "")}
              placeholder="e.g. 192.168.1.10"
            />
          </Flex>

          <Flex flexDirection="column" gap={4} style={{ minWidth: 240 }}>
            <Paragraph>
              <Strong>Destination IP</Strong>
            </Paragraph>
            <TextInput
              value={dstInput}
              onChange={(val) => setDstInput(val ?? "")}
              placeholder="e.g. 10.0.0.50"
            />
          </Flex>

          <Flex flexDirection="column" gap={4} style={{ minWidth: 240 }}>
            <Paragraph>
              <Strong>Timeframe</Strong>
            </Paragraph>
            <TimeframeSelector
              value={timeframe}
              onChange={(value) => { if (value) setTimeframe(value); }}
            />
          </Flex>

          <Flex gap={8}>
            <Button
              variant="accent"
              onClick={handleSearch}
              disabled={!canSearch}
            >
              Analyze Traffic
            </Button>
            {activeParams && (
              <Button variant="default" onClick={handleClear}>
                Clear
              </Button>
            )}
          </Flex>
        </Flex>

        {!canSearch && (
          <Paragraph style={{ marginTop: 8, color: Colors.Text.Neutral.Default }}>
            Enter at least one IP address to search.
          </Paragraph>
        )}
      </Surface>

      {activeParams && (
        <>
          <Surface style={{ padding: 24 }}>
            <Heading level={3} style={{ marginBottom: 4 }}>
              Blocked Traffic
            </Heading>
            <Paragraph style={{ marginBottom: 16, color: Colors.Text.Neutral.Default }}>
              Showing denied/dropped sessions
              {activeParams.src ? ` from ${activeParams.src}` : ""}
              {activeParams.dst ? ` to ${activeParams.dst}` : ""}
            </Paragraph>
            <BlockedResults params={activeParams} />
          </Surface>

          <BlockReasonSummary params={activeParams} />
        </>
      )}
    </Flex>
  );
};
