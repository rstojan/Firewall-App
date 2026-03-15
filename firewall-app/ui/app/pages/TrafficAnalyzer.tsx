import React, { useState } from "react";

import { Flex, Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Strong } from "@dynatrace/strato-components/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { TextInput } from "@dynatrace/strato-components-preview/forms";
import { DataTable, convertToColumns } from "@dynatrace/strato-components-preview/tables";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { CriticalIcon, SuccessIcon } from "@dynatrace/strato-icons";
import { useDql } from "@dynatrace-sdk/react-hooks";

// ─── Types ───────────────────────────────────────────────────────────────────

interface QueryParams {
  src: string;
  dst: string;
}

// ─── Query builder ───────────────────────────────────────────────────────────

function buildBlockedQuery(src: string, dst: string): string {
  const conditions: string[] = ['log.source == "palo-alto-firewall"', 'paloalto.action != "allow"'];
  if (src) conditions.push(`paloalto.src == "${src}"`);
  if (dst) conditions.push(`paloalto.dst == "${dst}"`);

  return `fetch logs
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

function buildAllTrafficQuery(src: string, dst: string): string {
  const conditions: string[] = ['log.source == "palo-alto-firewall"'];
  if (src) conditions.push(`paloalto.src == "${src}"`);
  if (dst) conditions.push(`paloalto.dst == "${dst}"`);

  return `fetch logs
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
  const query = buildBlockedQuery(params.src, params.dst);
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
              <Strong>No blocked traffic found</Strong> for the specified IPs in the last 2 hours.
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
          columns={convertToColumns(data.types)}
          resizable
        >
          <DataTable.Pagination defaultPageSize={25} />
        </DataTable>
      )}
    </Flex>
  );
};

const BlockReasonSummary = ({ params }: { params: QueryParams }) => {
  const query = buildAllTrafficQuery(params.src, params.dst);
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
          columns={convertToColumns(data.types)}
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
  const [activeParams, setActiveParams] = useState<QueryParams | null>(null);

  const canSearch = srcInput.trim() !== "" || dstInput.trim() !== "";

  function handleSearch() {
    if (!canSearch) return;
    setActiveParams({ src: srcInput.trim(), dst: dstInput.trim() });
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
        and understand why. Queries the last 2 hours of Palo Alto firewall logs.
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
