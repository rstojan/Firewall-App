import React, { useState } from "react";
import { Modal } from "@dynatrace/strato-components/overlays";
import { Flex, Surface, Divider } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { SearchInput } from "@dynatrace/strato-components/forms";
import { Button } from "@dynatrace/strato-components/buttons";
import {
  ChevronRightIcon,
  ChevronLeftIcon,
  ExternalLinkIcon,
} from "@dynatrace/strato-icons";
import { openApp } from "@dynatrace-sdk/navigation";

// ─── Extension metadata ─────────────────────────────────────────────────────

interface ExtensionItem {
  id: string;
  name: string;
  description: string;
  overview: string;
  logoSrc: string;
  screenshots: string[];
}

const EXTENSIONS: ExtensionItem[] = [
  {
    id: "com.dynatrace.extension.palo-alto-generic",
    name: "Palo Alto Networks PAN-OS",
    description:
      "Monitor Palo Alto Networks PAN-OS firewalls with full metric ingestion, topology mapping, and out-of-the-box dashboards.",
    overview:
      "This extension collects metrics from Palo Alto Networks PAN-OS devices via SNMP, providing comprehensive visibility into firewall health, interface statistics, session counts, and threat prevention.\n\nKey capabilities:\n\n\u2022 System health metrics \u2014 CPU, memory, session utilization, and disk usage\n\u2022 Interface monitoring \u2014 throughput, error rates, and operational status per interface\n\u2022 Threat prevention \u2014 antivirus, anti-spyware, and URL filtering statistics\n\u2022 GlobalProtect VPN \u2014 active tunnels, connected users, and bandwidth\n\u2022 High availability \u2014 HA state, peer status, and failover tracking\n\u2022 Topology mapping \u2014 automatic relationships between firewalls, interfaces, and zones\n\u2022 Pre-built dashboards \u2014 operational overview, traffic analysis, and threat summary",
    logoSrc: "./assets/PaloAlto.png",
    screenshots: [],
  },
  {
    id: "com.dynatrace.extension.checkpoint-firewall",
    name: "Check Point Firewall",
    description:
      "Monitor Check Point Security Gateways with SNMP-based metric collection, topology views, and pre-built dashboards.",
    overview:
      "This extension collects metrics from Check Point Security Gateways via SNMP, covering firewall performance, VPN tunnel health, and threat prevention counters.\n\nKey capabilities:\n\n\u2022 Firewall performance \u2014 connections, throughput, packet rates, and policy installation status\n\u2022 VPN monitoring \u2014 tunnel status, encrypted throughput, and IKE negotiations\n\u2022 Threat prevention \u2014 IPS, anti-bot, and antivirus detection counters\n\u2022 Hardware health \u2014 CPU, memory, disk, and fan status\n\u2022 Multi-domain support \u2014 monitor across multiple Check Point domains\n\u2022 Topology mapping \u2014 gateways, interfaces, and VS instances\n\u2022 Pre-built dashboards \u2014 security overview and gateway health",
    logoSrc: "./assets/CheckPoint.svg",
    screenshots: [],
  },
  {
    id: "com.dynatrace.extension.cisco-firepower",
    name: "Cisco Firepower",
    description:
      "Monitor Cisco Firepower Threat Defense and FMC appliances with SNMP metrics, topology, and operational dashboards.",
    overview:
      "This extension collects metrics from Cisco Firepower Threat Defense (FTD) and Firepower Management Center (FMC) via SNMP, providing visibility into appliance health and security posture.\n\nKey capabilities:\n\n\u2022 Appliance health \u2014 CPU, memory, disk, and interface utilization\n\u2022 Security intelligence \u2014 blocked connections, intrusion events, and malware detections\n\u2022 VPN monitoring \u2014 site-to-site and remote access tunnel status\n\u2022 NAT statistics \u2014 translation hit counts and pool utilization\n\u2022 Failover tracking \u2014 HA pair state, active/standby role, and switchover history\n\u2022 Topology mapping \u2014 FMC to managed devices, interfaces, and security zones\n\u2022 Pre-built dashboards \u2014 operational overview and security summary",
    logoSrc: "./assets/Cisco.svg",
    screenshots: [],
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface ExpandMonitoringModalProps {
  show: boolean;
  onDismiss: () => void;
}

export const ExpandMonitoringModal = ({
  show,
  onDismiss,
}: ExpandMonitoringModalProps) => {
  const [search, setSearch] = useState("");
  const [selectedExt, setSelectedExt] = useState<ExtensionItem | null>(null);

  const filtered = EXTENSIONS.filter(
    (ext) =>
      ext.name.toLowerCase().includes(search.toLowerCase()) ||
      ext.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleDismiss = () => {
    setSelectedExt(null);
    setSearch("");
    onDismiss();
  };

  return (
    <Modal
      title={selectedExt ? selectedExt.name : "Expand Monitoring"}
      show={show}
      onDismiss={handleDismiss}
      size="large"
    >
      {selectedExt ? (
        <Flex flexDirection="column" gap={20}>
          {/* Back button */}
          <Button variant="default" onClick={() => setSelectedExt(null)}>
            <Button.Prefix>
              <ChevronLeftIcon />
            </Button.Prefix>
            Back to extensions
          </Button>

          {/* Header: logo + name + Hub button */}
          <Flex alignItems="center" gap={16}>
            <Flex
              alignItems="center"
              justifyContent="center"
              style={{
                width: 56,
                height: 56,
                borderRadius: 8,
                backgroundColor: "var(--dt-colors-surfaces-secondary-default)",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              <img
                src={selectedExt.logoSrc}
                alt={selectedExt.name}
                style={{ width: 40, height: 40, objectFit: "contain" }}
              />
            </Flex>
            <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
              <Heading level={5}>{selectedExt.name}</Heading>
              <Paragraph>{selectedExt.description}</Paragraph>
            </Flex>
            <Button
              variant="emphasized"
              onClick={() => openApp("dynatrace.hub")}
            >
              <Button.Suffix><ExternalLinkIcon /></Button.Suffix>
              Browse in Hub
            </Button>
          </Flex>

          {/* Screenshots */}
          {selectedExt.screenshots.length > 0 && (
            <Flex
              gap={12}
              style={{ overflowX: "auto", paddingBottom: 8 }}
            >
              {selectedExt.screenshots.map((src, i) => (
                <Surface
                  key={i}
                  elevation="raised"
                  style={{
                    borderRadius: 8,
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={src}
                    alt={`${selectedExt.name} screenshot ${i + 1}`}
                    style={{
                      height: 200,
                      width: "auto",
                      display: "block",
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </Surface>
              ))}
            </Flex>
          )}

          <Divider />

          {/* Overview */}
          <Flex flexDirection="column" gap={8}>
            <Heading level={6}>Overview</Heading>
            <Paragraph style={{ whiteSpace: "pre-wrap" }}>
              {selectedExt.overview}
            </Paragraph>
          </Flex>
        </Flex>
      ) : (
        <Flex flexDirection="column" gap={16}>
          <SearchInput
            placeholder="Search extensions..."
            value={search}
            onChange={(val) => setSearch(val ?? "")}
          />
          <Flex flexDirection="column" gap={12}>
            {filtered.map((ext) => (
              <Surface
                key={ext.id}
                elevation="raised"
                style={{ cursor: "pointer", borderRadius: 8 }}
                onClick={() => setSelectedExt(ext)}
              >
                <Flex alignItems="center" gap={16} padding={20}>
                  <Flex
                    alignItems="center"
                    justifyContent="center"
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      backgroundColor:
                        "var(--dt-colors-surfaces-secondary-default)",
                      flexShrink: 0,
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={ext.logoSrc}
                      alt={ext.name}
                      style={{
                        width: 32,
                        height: 32,
                        objectFit: "contain",
                      }}
                    />
                  </Flex>
                  <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
                    <Paragraph style={{ fontWeight: 600 }}>
                      {ext.name}
                    </Paragraph>
                    <Paragraph>{ext.description}</Paragraph>
                  </Flex>
                  <ChevronRightIcon size={20} />
                </Flex>
              </Surface>
            ))}
            {filtered.length === 0 && (
              <Paragraph>No extensions match your search.</Paragraph>
            )}
          </Flex>
        </Flex>
      )}
    </Modal>
  );
};
