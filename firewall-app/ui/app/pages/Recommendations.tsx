import React, { useCallback, useEffect, useState } from "react";

import { Container, Divider, Flex, Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Strong } from "@dynatrace/strato-components/typography";
import { Accordion } from "@dynatrace/strato-components/content";
import { Chip } from "@dynatrace/strato-components/content";
import { Button } from "@dynatrace/strato-components/buttons";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ExternalLinkIcon,
  InformationIcon,
  SuccessIcon,
  CriticalIcon,
} from "@dynatrace/strato-icons";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { appSettingsObjectsClient } from "@dynatrace-sdk/client-app-settings-v2";

// ─── Constants ──────────────────────────────────────────────────────────────

const SCHEMA_ID = "firewall-detection-rules";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RecommendationItem {
  name: string;
  description: string;
  recommended?: boolean;
  category: string;
  dqlQuery: string;
}

interface RecommendationCategory {
  id: string;
  title: string;
  items: RecommendationItem[];
}

/** Tracks a persisted settings object ID for each activated rule. */
type ActivationMap = Record<string, { objectId: string; version: string }>;

// ─── Settings API helpers ───────────────────────────────────────────────────

async function loadActivatedRules(): Promise<ActivationMap> {
  try {
    const result = await appSettingsObjectsClient.getAppSettingsObjects({
      schemaId: SCHEMA_ID,
      addFields: "objectId,version,value",
      pageSize: 500,
    });

    const map: ActivationMap = {};
    for (const obj of result.items ?? []) {
      const name = (obj.value as Record<string, unknown>)?.ruleName as string | undefined;
      if (name) {
        map[name] = { objectId: obj.objectId!, version: obj.version! };
      }
    }
    return map;
  } catch {
    // Schema may not exist yet — treat as empty
    return {};
  }
}

async function activateRule(item: RecommendationItem): Promise<{ objectId: string; version: string } | null> {
  try {
    const result = await appSettingsObjectsClient.postAppSettingsObject({
      body: {
        schemaId: SCHEMA_ID,
        value: {
          ruleName: item.name,
          category: item.category,
          description: item.description,
          recommended: item.recommended ?? false,
          dqlQuery: item.dqlQuery,
          enabled: true,
        },
      },
    });

    if (result && typeof result === "object" && "objectId" in result) {
      return {
        objectId: (result as { objectId: string }).objectId,
        version: (result as { version: string }).version ?? "0",
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function deactivateRule(objectId: string, version: string): Promise<boolean> {
  try {
    await appSettingsObjectsClient.deleteAppSettingsObjectByObjectId({
      objectId,
      optimisticLockingVersion: version,
    });
    return true;
  } catch {
    return false;
  }
}

// ─── Recommendation definitions ─────────────────────────────────────────────

const CATEGORIES: RecommendationCategory[] = [
  {
    id: "traffic",
    title: "Traffic anomaly alerts",
    items: [
      {
        name: "Blocked traffic spike",
        description:
          "Detects when blocked session count exceeds 2x the rolling average over the past hour, indicating a potential attack or misconfiguration.",
        recommended: true,
        category: "traffic",
        dqlQuery: `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action != "allow"
| makeTimeseries blocked = count(), interval: 5m
| fieldsAdd avg_blocked = arrayAvg(blocked)
| filter last(blocked) > 2 * avg_blocked`,
      },
      {
        name: "Unusual outbound data volume",
        description:
          "Alerts when a single source IP sends more than 100 MB outbound in a 15-minute window, which may indicate data exfiltration.",
        recommended: true,
        category: "traffic",
        dqlQuery: `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action == "allow"
| summarize total_sent = sum(paloalto.bytes_sent), by: { paloalto.src, bin(timestamp, 15m) }
| filter total_sent > 104857600`,
      },
      {
        name: "Zero allowed traffic",
        description:
          "Detects periods with no allowed traffic for 10+ minutes, suggesting a network outage or overly restrictive policy change.",
        category: "traffic",
        dqlQuery: `fetch logs
| filter log.source == "palo-alto-firewall"
| makeTimeseries allowed = countIf(paloalto.action == "allow"), interval: 10m
| filter last(allowed) == 0`,
      },
    ],
  },
  {
    id: "source",
    title: "Source & destination alerts",
    items: [
      {
        name: "Port scan detection",
        description:
          "Identifies a single source IP targeting 20+ unique destination ports within 5 minutes — a strong indicator of reconnaissance activity.",
        recommended: true,
        category: "source",
        dqlQuery: `fetch logs
| filter log.source == "palo-alto-firewall"
| summarize unique_ports = countDistinct(paloalto.dport), by: { paloalto.src, bin(timestamp, 5m) }
| filter unique_ports > 20`,
      },
      {
        name: "Brute force attempt",
        description:
          "Detects a single source IP being blocked 50+ times in 10 minutes against the same destination, typical of credential-stuffing or brute force attacks.",
        recommended: true,
        category: "source",
        dqlQuery: `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action != "allow"
| summarize block_count = count(), by: { paloalto.src, paloalto.dst, bin(timestamp, 10m) }
| filter block_count > 50`,
      },
      {
        name: "Top blocked source threshold",
        description:
          "Alerts when a single source IP accumulates 500+ blocked sessions in an hour.",
        category: "source",
        dqlQuery: `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action != "allow"
| summarize block_count = count(), by: { paloalto.src }
| filter block_count > 500`,
      },
      {
        name: "Top blocked destination threshold",
        description:
          "Alerts when a single destination IP accumulates 500+ blocked sessions in an hour, possibly indicating a targeted service under attack.",
        category: "source",
        dqlQuery: `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action != "allow"
| summarize block_count = count(), by: { paloalto.dst }
| filter block_count > 500`,
      },
      {
        name: "Lateral movement detection",
        description:
          "Detects a single source IP communicating with 10+ unique internal destinations in a short window, which may indicate lateral movement after initial compromise.",
        category: "source",
        dqlQuery: `fetch logs
| filter log.source == "palo-alto-firewall"
| summarize unique_dsts = countDistinct(paloalto.dst), by: { paloalto.src, bin(timestamp, 10m) }
| filter unique_dsts > 10`,
      },
    ],
  },
  {
    id: "policy",
    title: "Policy & rule alerts",
    items: [
      {
        name: "High block-rate zone pair",
        description:
          "Flags zone pairs where the block rate exceeds 80%, which may indicate a misconfigured policy or an unexpected traffic pattern.",
        recommended: true,
        category: "policy",
        dqlQuery: `fetch logs
| filter log.source == "palo-alto-firewall"
| summarize total = count(),
            blocked = countIf(paloalto.action != "allow"),
            by: { paloalto.from_zone, paloalto.to_zone }
| fieldsAdd block_rate = toDouble(blocked) / toDouble(total) * 100
| filter block_rate > 80`,
      },
      {
        name: "Single rule dominating blocks",
        description:
          "Detects when a single firewall rule accounts for 90%+ of all blocked traffic, which could indicate a blanket deny that needs refinement.",
        category: "policy",
        dqlQuery: `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action != "allow"
| summarize rule_blocks = count(), by: { paloalto.rule }
| fieldsAdd total_blocks = sum(rule_blocks)
| fieldsAdd pct = toDouble(rule_blocks) / toDouble(total_blocks) * 100
| filter pct > 90`,
      },
      {
        name: "Denied zone crossing",
        description:
          "Alerts on traffic that attempts to cross between zones and is denied — may reveal unauthorized network traversal attempts.",
        category: "policy",
        dqlQuery: `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action != "allow"
| filter paloalto.from_zone != paloalto.to_zone
| summarize count = count(), by: { paloalto.from_zone, paloalto.to_zone, paloalto.rule }
| sort count desc`,
      },
    ],
  },
  {
    id: "highrisk",
    title: "High-risk port alerts",
    items: [
      {
        name: "RDP access attempts",
        description:
          "Monitors blocked connections to port 3389 (RDP). Frequent attempts may indicate brute force or unauthorized remote access attempts.",
        recommended: true,
        category: "highrisk",
        dqlQuery: `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action != "allow"
| filter paloalto.dport == 3389
| summarize count = count(), unique_sources = countDistinct(paloalto.src), by: { paloalto.dst }
| filter count > 10`,
      },
      {
        name: "Database port exposure",
        description:
          "Detects blocked traffic to database ports (1433 SQL Server, 3306 MySQL, 5432 PostgreSQL), which should never be exposed externally.",
        recommended: true,
        category: "highrisk",
        dqlQuery: `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action != "allow"
| filter paloalto.dport == 1433 OR paloalto.dport == 3306 OR paloalto.dport == 5432
| summarize count = count(), by: { paloalto.dport, paloalto.src }
| filter count > 5`,
      },
      {
        name: "FTP and Telnet usage",
        description:
          "Flags any traffic (allowed or blocked) to legacy insecure ports 21 (FTP) and 23 (Telnet). These protocols transmit credentials in plain text.",
        category: "highrisk",
        dqlQuery: `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.dport == 21 OR paloalto.dport == 23
| summarize count = count(), by: { paloalto.dport, paloalto.action, paloalto.src }
| sort count desc`,
      },
      {
        name: "Suspicious outbound ports",
        description:
          "Detects allowed outbound traffic on ports commonly used by malware C2 channels (4444, 5555, 6666, 8888).",
        category: "highrisk",
        dqlQuery: `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action == "allow"
| filter paloalto.dport == 4444 OR paloalto.dport == 5555 OR paloalto.dport == 6666 OR paloalto.dport == 8888
| summarize count = count(), by: { paloalto.src, paloalto.dst, paloalto.dport }`,
      },
    ],
  },
  {
    id: "session",
    title: "Session & device alerts",
    items: [
      {
        name: "Abnormal session terminations",
        description:
          "Alerts when threat-related session end reasons (threat, policy-deny, decrypt-error) exceed a threshold, indicating active threats hitting the firewall.",
        recommended: true,
        category: "session",
        dqlQuery: `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.session_end_reason == "threat" OR paloalto.session_end_reason == "policy-deny" OR paloalto.session_end_reason == "decrypt-error"
| summarize count = count(), by: { paloalto.session_end_reason }
| filter count > 100`,
      },
      {
        name: "Device log gap detection",
        description:
          "Detects when a known firewall device stops sending logs for 15+ minutes, which may indicate a device failure or network connectivity issue.",
        category: "session",
        dqlQuery: `fetch logs
| filter log.source == "palo-alto-firewall"
| summarize last_seen = max(timestamp), by: { paloalto.device_name }
| filter (now() - last_seen) > 15m`,
      },
      {
        name: "Single app generating excessive blocks",
        description:
          "Flags a single application generating 200+ blocked sessions, indicating either misconfiguration or an app exploiting known vulnerabilities.",
        category: "session",
        dqlQuery: `fetch logs
| filter log.source == "palo-alto-firewall"
| filter paloalto.action != "allow"
| summarize block_count = count(), by: { paloalto.app }
| filter block_count > 200`,
      },
    ],
  },
];

// ─── Recommendation item row ────────────────────────────────────────────────

const RecommendationRow = ({
  item,
  isActive,
  isBusy,
  onToggle,
}: {
  item: RecommendationItem;
  isActive: boolean;
  isBusy: boolean;
  onToggle: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Flex flexDirection="column" style={{ padding: "8px 0" }}>
      {/* Summary row */}
      <Flex
        alignItems="center"
        justifyContent="space-between"
        style={{ cursor: "pointer" }}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <Flex alignItems="center" gap={8}>
          {expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
          <Paragraph><Strong>{item.name}</Strong></Paragraph>
          {item.recommended && (
            <Chip color="primary" variant="emphasized">Recommended</Chip>
          )}
        </Flex>
        <Flex alignItems="center" gap={8}>
          {isBusy ? (
            <ProgressCircle size="small" />
          ) : (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onToggle(); } }}
              style={{
                color: isActive ? Colors.Text.Success.Default : Colors.Text.Neutral.Default,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              {isActive ? "Active" : "Inactive"}
            </span>
          )}
          <InformationIcon />
        </Flex>
      </Flex>

      {/* Expanded detail */}
      {expanded && (
        <Flex flexDirection="column" gap={12} style={{ padding: "12px 0 8px 28px" }}>
          <Paragraph>{item.description}</Paragraph>
          <Flex flexDirection="column" gap={4}>
            <Paragraph><Strong>DQL Query</Strong></Paragraph>
            <pre
              style={{
                backgroundColor: Colors.Theme.Neutral["10"],
                padding: 12,
                borderRadius: 4,
                fontSize: 13,
                fontFamily: "monospace",
                overflowX: "auto",
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {item.dqlQuery}
            </pre>
          </Flex>
          <Flex gap={8}>
            <Button
              variant={isActive ? "default" : "accent"}
              color={isActive ? "neutral" : "primary"}
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              disabled={isBusy}
            >
              {isBusy ? "Saving..." : isActive ? "Deactivate" : "Activate"}
            </Button>
          </Flex>
        </Flex>
      )}
    </Flex>
  );
};

// ─── Category section ───────────────────────────────────────────────────────

const CategorySection = ({
  category,
  activationMap,
  busyItems,
  onActivateAll,
  onDeactivateAll,
  onToggleItem,
}: {
  category: RecommendationCategory;
  activationMap: ActivationMap;
  busyItems: Set<string>;
  onActivateAll: () => void;
  onDeactivateAll: () => void;
  onToggleItem: (name: string) => void;
}) => {
  const activeCount = category.items.filter((i) => i.name in activationMap).length;
  const inactiveCount = category.items.length - activeCount;
  const recommendedInactive = category.items.filter(
    (i) => i.recommended && !(i.name in activationMap)
  ).length;
  const allActive = inactiveCount === 0;
  const categoryBusy = category.items.some((i) => busyItems.has(i.name));

  return (
    <Flex flexDirection="column" gap={4}>
      <Heading level={5}>{category.title}</Heading>

      {/* Status banner */}
      {allActive ? (
        <Container variant="default" color="success" padding={12}>
          <Flex alignItems="center" justifyContent="space-between">
            <Flex alignItems="center" gap={8}>
              <SuccessIcon />
              <Paragraph>
                All recommended alerts are active and monitoring your firewall traffic.
              </Paragraph>
            </Flex>
            <Button variant="default" onClick={onDeactivateAll} disabled={categoryBusy}>
              <Button.Suffix><ExternalLinkIcon /></Button.Suffix>
              Configure
            </Button>
          </Flex>
        </Container>
      ) : (
        <Container variant="default" color="primary" padding={12}>
          <Flex alignItems="center" justifyContent="space-between">
            <Flex alignItems="center" gap={8}>
              <InformationIcon />
              <Paragraph>
                {recommendedInactive > 0
                  ? `${recommendedInactive} recommended alert${recommendedInactive !== 1 ? "s" : ""} ${recommendedInactive !== 1 ? "are" : "is"} inactive.`
                  : `${inactiveCount} alert${inactiveCount !== 1 ? "s" : ""} ${inactiveCount !== 1 ? "are" : "is"} inactive.`}
              </Paragraph>
            </Flex>
            <Button variant="accent" color="primary" onClick={onActivateAll} disabled={categoryBusy}>
              <Button.Suffix><ExternalLinkIcon /></Button.Suffix>
              Activate
            </Button>
          </Flex>
        </Container>
      )}

      {/* Expandable item list */}
      <Accordion>
        <Accordion.Section id={`acc-${category.id}`}>
          <Accordion.SectionLabel>
            {activeCount} active, {inactiveCount} inactive
          </Accordion.SectionLabel>
          <Accordion.SectionContent>
            <Flex flexDirection="column">
              {category.items.map((item) => (
                <React.Fragment key={item.name}>
                  <RecommendationRow
                    item={item}
                    isActive={item.name in activationMap}
                    isBusy={busyItems.has(item.name)}
                    onToggle={() => onToggleItem(item.name)}
                  />
                  <Divider />
                </React.Fragment>
              ))}
            </Flex>
          </Accordion.SectionContent>
        </Accordion.Section>
      </Accordion>
    </Flex>
  );
};

// ─── Page ───────────────────────────────────────────────────────────────────

/** Flat lookup of item by name across all categories. */
const ALL_ITEMS: Record<string, RecommendationItem> = {};
for (const cat of CATEGORIES) {
  for (const item of cat.items) {
    ALL_ITEMS[item.name] = item;
  }
}

export const Recommendations = () => {
  const [activationMap, setActivationMap] = useState<ActivationMap>({});
  const [busyItems, setBusyItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load persisted state on mount
  useEffect(() => {
    let cancelled = false;
    loadActivatedRules()
      .then((map) => { if (!cancelled) setActivationMap(map); })
      .catch((err) => { if (!cancelled) setError(String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const markBusy = useCallback((name: string, busy: boolean) => {
    setBusyItems((prev) => {
      const next = new Set(prev);
      if (busy) next.add(name); else next.delete(name);
      return next;
    });
  }, []);

  const toggleItem = useCallback(async (name: string) => {
    const existing = activationMap[name];
    markBusy(name, true);

    if (existing) {
      // Deactivate
      const ok = await deactivateRule(existing.objectId, existing.version);
      if (ok) {
        setActivationMap((prev) => {
          const next = { ...prev };
          delete next[name];
          return next;
        });
      }
    } else {
      // Activate
      const item = ALL_ITEMS[name];
      if (item) {
        const result = await activateRule(item);
        if (result) {
          setActivationMap((prev) => ({ ...prev, [name]: result }));
        }
      }
    }

    markBusy(name, false);
  }, [activationMap, markBusy]);

  const activateAllInCategory = useCallback(async (category: RecommendationCategory) => {
    const inactive = category.items.filter((i) => !(i.name in activationMap));
    for (const item of inactive) markBusy(item.name, true);

    const results = await Promise.all(
      inactive.map(async (item) => {
        const result = await activateRule(item);
        markBusy(item.name, false);
        return { name: item.name, result };
      })
    );

    setActivationMap((prev) => {
      const next = { ...prev };
      for (const { name, result } of results) {
        if (result) next[name] = result;
      }
      return next;
    });
  }, [activationMap, markBusy]);

  const deactivateAllInCategory = useCallback(async (category: RecommendationCategory) => {
    const active = category.items.filter((i) => i.name in activationMap);
    for (const item of active) markBusy(item.name, true);

    const results = await Promise.all(
      active.map(async (item) => {
        const entry = activationMap[item.name];
        const ok = entry ? await deactivateRule(entry.objectId, entry.version) : false;
        markBusy(item.name, false);
        return { name: item.name, ok };
      })
    );

    setActivationMap((prev) => {
      const next = { ...prev };
      for (const { name, ok } of results) {
        if (ok) delete next[name];
      }
      return next;
    });
  }, [activationMap, markBusy]);

  if (loading) {
    return (
      <Flex justifyContent="center" alignItems="center" padding={64}>
        <ProgressCircle />
      </Flex>
    );
  }

  return (
    <Flex flexDirection="column" padding={32} gap={24}>
      <Surface elevation="flat" padding={16}>
        <Heading level={1}>Recommended detection rules</Heading>
        <Paragraph style={{ marginTop: 4 }}>
          Anomaly detection rules tailored to Palo Alto PAN-OS traffic logs. Activate
          recommendations to persist them as app settings in Dynatrace. Active rules
          are saved and will remain enabled across sessions.
        </Paragraph>
      </Surface>

      {error && (
        <Container variant="default" color="warning" padding={12}>
          <Flex alignItems="center" gap={8}>
            <CriticalIcon />
            <Paragraph>
              Could not load saved rules. Changes will not persist. ({error})
            </Paragraph>
          </Flex>
        </Container>
      )}

      {CATEGORIES.map((cat) => (
        <CategorySection
          key={cat.id}
          category={cat}
          activationMap={activationMap}
          busyItems={busyItems}
          onActivateAll={() => activateAllInCategory(cat)}
          onDeactivateAll={() => deactivateAllInCategory(cat)}
          onToggleItem={toggleItem}
        />
      ))}
    </Flex>
  );
};
