import React, { useMemo, useState } from "react";

import { Divider, Flex, Grid, Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { DataTable, convertToColumns } from "@dynatrace/strato-components-preview/tables";
import { FormField, Label, Select, SelectOption } from "@dynatrace/strato-components/forms";
import { TimeframeSelector } from "@dynatrace/strato-components/filters";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { CriticalIcon } from "@dynatrace/strato-icons";
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

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_TIMEFRAME: Timeframe = {
  from: { absoluteDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), value: "now()-2h", type: "expression" },
  to: { absoluteDate: new Date().toISOString(), value: "now()", type: "expression" },
};

// ─── Filter definitions ──────────────────────────────────────────────────────

interface FilterDef {
  label: string;
  field: string;
}

const FILTERS: FilterDef[] = [
  { label: "Action", field: "paloalto.action" },
  { label: "App", field: "paloalto.app" },
  { label: "Rule", field: "paloalto.rule" },
  { label: "From Zone", field: "paloalto.from_zone" },
  { label: "To Zone", field: "paloalto.to_zone" },
  { label: "Session End Reason", field: "paloalto.session_end_reason" },
  { label: "Device", field: "paloalto.device_name" },
];

type FilterState = Record<string, string[]>;

// ─── Queries ─────────────────────────────────────────────────────────────────

function buildDistinctQuery(field: string): string {
  return `fetch logs
| filter log.source == "palo-alto-firewall"
| summarize count = count(), by: { ${field} }
| sort count desc
| limit 200
| fields ${field}`;
}

function buildLogsQuery(filters: FilterState): string {
  const conditions: string[] = ['log.source == "palo-alto-firewall"'];

  for (const { field } of FILTERS) {
    const vals = filters[field];
    if (vals && vals.length > 0) {
      const clauses = vals.map((v) => `${field} == "${v}"`).join(" OR ");
      conditions.push(`(${clauses})`);
    }
  }

  return `fetch logs
| filter ${conditions.join("\n         AND ")}
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
| limit 500`;
}

// ─── Filter dropdown component ───────────────────────────────────────────────

const FilterDropdown = ({
  def,
  timeframe,
  value,
  onChange,
}: {
  def: FilterDef;
  timeframe: Timeframe;
  value: string[];
  onChange: (vals: string[]) => void;
}) => {
  const query = buildDistinctQuery(def.field);
  const params = useMemo(
    () => ({
      query,
      defaultTimeframeStart: timeframe.from.absoluteDate,
      defaultTimeframeEnd: timeframe.to.absoluteDate,
    }),
    [query, timeframe]
  );
  const { data } = useDql(params);

  const options = useMemo(() => {
    if (!data?.records) return [];
    return data.records
      .map((r) => String(r[def.field] ?? ""))
      .filter(Boolean);
  }, [data, def.field]);

  return (
    <FormField>
      <Label>{def.label}</Label>
      <Select<string, true>
        name={def.field}
        multiple={true}
        value={value}
        onChange={(vals) => onChange(vals as string[])}
        clearable
      >
        <Select.Trigger placeholder={def.label} />
        <Select.Content>
          {options.map((opt) => (
            <SelectOption key={opt} value={opt}>
              {opt}
            </SelectOption>
          ))}
        </Select.Content>
      </Select>
    </FormField>
  );
};

// ─── Page ────────────────────────────────────────────────────────────────────

export const FirewallLogs = () => {
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);
  const [filters, setFilters] = useState<FilterState>({});

  const updateFilter = (field: string, vals: string[]) => {
    setFilters((prev) => ({ ...prev, [field]: vals }));
  };

  const query = useMemo(() => buildLogsQuery(filters), [filters]);
  const params = useMemo(
    () => ({
      query,
      defaultTimeframeStart: timeframe.from.absoluteDate,
      defaultTimeframeEnd: timeframe.to.absoluteDate,
    }),
    [query, timeframe]
  );
  const { data, error, isLoading } = useDql(params);

  return (
    <Flex flexDirection="column" padding={32} gap={16}>
      {/* Page header with timeframe */}
      <Surface elevation="flat" padding={16}>
        <Flex alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={16}>
          <Heading level={1}>Firewall Logs</Heading>
          <TimeframeSelector
            value={timeframe}
            onChange={(value) => { if (value) setTimeframe(value); }}
          />
        </Flex>
      </Surface>

      {/* Filters */}
      <Surface elevation="raised" padding={16}>
        <Paragraph><strong>Filters</strong></Paragraph>
        <Divider style={{ marginTop: 8, marginBottom: 12 }} />
        <Grid gridTemplateColumns="repeat(auto-fill, minmax(180px, 1fr))" gap={12}>
          {FILTERS.map((def) => (
            <FilterDropdown
              key={def.field}
              def={def}
              timeframe={timeframe}
              value={filters[def.field] ?? []}
              onChange={(vals) => updateFilter(def.field, vals)}
            />
          ))}
        </Grid>
      </Surface>

      {/* Data table */}
      <Surface elevation="raised" padding={24}>
        {isLoading && (
          <Flex justifyContent="center" alignItems="center" style={{ minHeight: 120 }}>
            <ProgressCircle />
          </Flex>
        )}
        {error && (
          <Flex alignItems="center" gap={8} style={{ color: Colors.Text.Critical.Default }} padding={16}>
            <CriticalIcon />
            <Paragraph>{error.message}</Paragraph>
          </Flex>
        )}
        {data?.records && data.types && (
          <DataTable
            data={data.records}
            columns={prettyColumns(data.types)}
            resizable
          >
            <DataTable.Pagination defaultPageSize={25} />
          </DataTable>
        )}
      </Surface>
    </Flex>
  );
};
