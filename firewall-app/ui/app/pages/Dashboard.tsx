import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

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

const Q_GEO_BLOCKED_EXT = `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action != "allow"
| summarize block_count = count(),
            unique_targets = countDistinct(paloalto.dst),
            by: { paloalto.src }
| sort block_count desc
| limit 100`;

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
          columns={convertToColumns(tableData.types)}
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
          columns={convertToColumns(data.types)}
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
          columns={convertToColumns(data.types)}
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
          columns={convertToColumns(data.types)}
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
          columns={convertToColumns(data.types)}
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
          variant="line"
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
          columns={convertToColumns(data.types)}
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
          columns={convertToColumns(data.types)}
          resizable
        >
          <DataTable.Pagination defaultPageSize={10} />
        </DataTable>
      )}
    </Surface>
  );
};

// ─── Geo Map ────────────────────────────────────────────────────────────────

// Simplified continent outlines as [lon, lat][] for equirectangular projection.
const CONTINENTS: [number, number][][] = [
  // North America
  [[-130,55],[-120,60],[-110,68],[-95,72],[-80,70],[-65,60],[-55,48],[-65,44],[-70,42],[-75,35],[-80,25],[-85,18],[-90,15],[-105,18],[-115,28],[-125,42],[-130,55]],
  // Central America & Caribbean
  [[-90,15],[-85,12],[-83,8],[-78,8],[-77,18],[-85,22],[-90,20],[-90,15]],
  // South America
  [[-80,10],[-75,12],[-60,10],[-50,2],[-35,-5],[-35,-15],[-40,-22],[-50,-30],[-55,-38],[-65,-55],[-68,-52],[-75,-45],[-75,-15],[-80,-2],[-80,10]],
  // Europe
  [[-10,36],[0,43],[3,47],[5,52],[10,55],[15,55],[20,58],[28,60],[30,70],[25,72],[10,64],[5,62],[-5,58],[-10,52],[-10,36]],
  // Africa
  [[-15,32],[-17,14],[-10,5],[-5,5],[8,4],[10,-2],[12,-5],[28,-15],[32,-26],[28,-33],[20,-35],[15,-28],[12,-15],[30,-5],[42,2],[42,10],[50,12],[38,15],[35,30],[10,37],[-5,36],[-15,32]],
  // Asia (mainland)
  [[28,60],[35,55],[40,42],[30,36],[35,32],[42,15],[50,12],[55,25],[60,25],[65,20],[70,22],[75,15],[80,8],[85,22],[90,22],[95,16],[100,13],[105,10],[110,20],[120,22],[125,32],[130,35],[132,42],[140,45],[142,46],[145,50],[140,55],[130,55],[120,52],[100,55],[80,52],[70,55],[60,55],[50,55],[40,60],[28,60]],
  // Australia
  [[115,-12],[120,-14],[130,-12],[137,-12],[145,-15],[150,-22],[152,-28],[150,-35],[140,-38],[132,-35],[128,-32],[115,-24],[114,-20],[115,-12]],
  // Greenland
  [[-55,60],[-45,60],[-20,68],[-20,76],[-30,82],[-50,82],[-55,78],[-45,72],[-50,65],[-55,60]],
  // Japan/Korea
  [[128,32],[130,34],[132,35],[134,38],[140,42],[142,45],[140,46],[135,40],[130,34],[128,32]],
  // Indonesia/Malaysia
  [[95,6],[100,2],[105,-2],[108,-6],[112,-8],[115,-8],[120,-10],[128,-8],[130,-2],[128,2],[118,4],[110,2],[105,5],[95,6]],
];

function isPrivateIp(ip: string): boolean {
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("127.")) return true;
  if (ip.startsWith("169.254.")) return true;
  if (ip.startsWith("0.")) return true;
  // 172.16.0.0 – 172.31.255.255
  if (ip.startsWith("172.")) {
    const second = parseInt(ip.split(".")[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

interface GeoPoint {
  ip: string;
  lat: number;
  lon: number;
  country: string;
  city: string;
  blockCount: number;
  uniqueTargets: number;
}

interface GeoCache {
  [ip: string]: { country: string; city: string; lat: number; lon: number } | null;
}

function useGeoLocate(ips: string[]) {
  const [geoCache, setGeoCache] = useState<GeoCache>({});
  const [isLoading, setIsLoading] = useState(false);

  // Determine which IPs still need resolving
  const unresolvedIps = useMemo(
    () => ips.filter((ip) => !(ip in geoCache)),
    [ips, geoCache]
  );

  useEffect(() => {
    if (unresolvedIps.length === 0) return;
    let cancelled = false;
    setIsLoading(true);

    // Resolve in small batches to avoid overwhelming the API
    async function resolve() {
      const batch = unresolvedIps.slice(0, 40);
      const results: GeoCache = {};

      await Promise.all(
        batch.map(async (ip) => {
          try {
            const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);
            if (!res.ok) { results[ip] = null; return; }
            const d = await res.json();
            if (d.success === false) { results[ip] = null; return; }
            results[ip] = {
              country: d.country ?? "Unknown",
              city: d.city ?? "Unknown",
              lat: d.latitude ?? 0,
              lon: d.longitude ?? 0,
            };
          } catch {
            results[ip] = null;
          }
        })
      );

      if (!cancelled) {
        setGeoCache((prev) => ({ ...prev, ...results }));
        setIsLoading(false);
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [unresolvedIps.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return { geoCache, isLoading };
}

const GeoBlockedMap = () => {
  const { data: dqlData, error: dqlError, isLoading: dqlLoading } = useFilteredDql(Q_GEO_BLOCKED_EXT);
  const [hovered, setHovered] = useState<GeoPoint | null>(null);

  // Extract IPs from DQL results, filtering out private/internal addresses
  const ipRecords = useMemo(() => {
    if (!dqlData?.records) return [];
    return dqlData.records
      .map((r) => ({
        ip: String(r["paloalto.src"] ?? ""),
        blockCount: Number(r["block_count"] ?? 0),
        uniqueTargets: Number(r["unique_targets"] ?? 0),
      }))
      .filter((r) => r.ip && !isPrivateIp(r.ip))
      .slice(0, 40);
  }, [dqlData]);

  const ips = useMemo(() => ipRecords.map((r) => r.ip).filter(Boolean), [ipRecords]);

  // Geolocate IPs from the browser
  const { geoCache, isLoading: geoLoading } = useGeoLocate(ips);

  // Merge DQL data with geo results
  const points: GeoPoint[] = useMemo(() => {
    return ipRecords
      .filter((r) => geoCache[r.ip] != null)
      .map((r) => {
        const geo = geoCache[r.ip]!;
        return {
          ip: r.ip,
          lat: geo.lat,
          lon: geo.lon,
          country: geo.country,
          city: geo.city,
          blockCount: r.blockCount,
          uniqueTargets: r.uniqueTargets,
        };
      });
  }, [ipRecords, geoCache]);

  const isLoading = dqlLoading || (ips.length > 0 && geoLoading);
  const error = dqlError;

  const maxBlocks = Math.max(...points.map((p) => p.blockCount), 1);

  // Equirectangular projection
  const mapW = 900;
  const mapH = 460;
  const padX = 20;
  const padY = 20;

  function lonToX(lon: number) {
    return padX + ((lon + 180) / 360) * (mapW - 2 * padX);
  }
  function latToY(lat: number) {
    return padY + ((90 - lat) / 180) * (mapH - 2 * padY);
  }

  // Convert continent outlines to SVG path strings
  const continentPaths = CONTINENTS.map((coords) =>
    coords.map((p, j) => `${j === 0 ? "M" : "L"}${lonToX(p[0]).toFixed(1)},${latToY(p[1]).toFixed(1)}`).join(" ") + " Z"
  );

  return (
    <Surface style={{ padding: 24 }}>
      <SectionHeader title="Blocked External IPs — Global Map" />
      {isLoading && <LoadingSpinner />}
      {error && <QueryError message={error.message} />}
      {!isLoading && !error && points.length === 0 && dqlData && (
        <Paragraph>No geolocated blocked external IPs found.</Paragraph>
      )}
      {points.length > 0 && (
        <div style={{ position: "relative", overflowX: "auto" }}>
          <svg
            width={mapW}
            height={mapH}
            viewBox={`0 0 ${mapW} ${mapH}`}
            style={{ fontFamily: "var(--dt-font-family-default, sans-serif)", fontSize: 11, display: "block" }}
          >
            {/* Ocean background */}
            <rect x={0} y={0} width={mapW} height={mapH} rx={8} fill="#0e1c2f" />

            {/* Grid lines */}
            {[-60, -30, 0, 30, 60].map((lat) => (
              <line
                key={`glat-${lat}`}
                x1={padX} y1={latToY(lat)} x2={mapW - padX} y2={latToY(lat)}
                stroke="#1a3050" strokeWidth={0.5}
              />
            ))}
            {[-120, -60, 0, 60, 120].map((lon) => (
              <line
                key={`glon-${lon}`}
                x1={lonToX(lon)} y1={padY} x2={lonToX(lon)} y2={mapH - padY}
                stroke="#1a3050" strokeWidth={0.5}
              />
            ))}

            {/* Continent outlines */}
            {continentPaths.map((d, i) => (
              <path key={`cont-${i}`} d={d} fill="#1a3a2a" stroke="#2d6b4a" strokeWidth={0.8} opacity={0.7} />
            ))}

            {/* Equator */}
            <line
              x1={padX} y1={latToY(0)} x2={mapW - padX} y2={latToY(0)}
              stroke="#1a3050" strokeWidth={1} strokeDasharray="4,4"
            />

            {/* Blocked IP dots */}
            {points.map((pt, i) => {
              const r = 4 + 10 * (pt.blockCount / maxBlocks);
              const cx = lonToX(pt.lon);
              const cy = latToY(pt.lat);
              return (
                <g
                  key={`pt-${i}`}
                  onMouseEnter={() => setHovered(pt)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Glow ring */}
                  <circle cx={cx} cy={cy} r={r + 3} fill="none" stroke="#ff4d4f" strokeWidth={1.5} opacity={0.3} />
                  {/* Main dot */}
                  <circle cx={cx} cy={cy} r={r} fill="#ff4d4f" fillOpacity={0.75} stroke="#ff8a8a" strokeWidth={1} />
                  {/* Label for high-count IPs */}
                  {pt.blockCount > maxBlocks * 0.4 && (
                    <text x={cx} y={cy - r - 5} textAnchor="middle" fill="#ff8a8a" fontSize={9}>
                      {pt.ip}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          {hovered && (
            <div
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                background: "rgba(14, 28, 47, 0.95)",
                border: "1px solid #2d6b4a",
                borderRadius: 8,
                padding: "12px 16px",
                color: "#e0e0e0",
                fontSize: 12,
                lineHeight: 1.6,
                pointerEvents: "none",
                minWidth: 180,
              }}
            >
              <div style={{ fontWeight: "bold", color: "#ff8a8a", marginBottom: 4 }}>{hovered.ip}</div>
              <div>{hovered.city}, {hovered.country}</div>
              <div>Lat: {hovered.lat.toFixed(2)}, Lon: {hovered.lon.toFixed(2)}</div>
              <div style={{ color: "#ff4d4f", fontWeight: "bold" }}>Blocked: {hovered.blockCount}</div>
              <div>Unique targets: {hovered.uniqueTargets}</div>
            </div>
          )}
        </div>
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

          <OverviewSection />

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

          <GeoBlockedMap />

          <TimeseriesSection />

          <HighRiskTable />

          <Flex gap={16} flexWrap="wrap">
            <SessionReasonsTable />
            <BandwidthChart />
          </Flex>
        </Flex>
      </TimeframeContext.Provider>
    </SegmentsProvider>
  );
};
