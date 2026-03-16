import React, { useState } from "react";
import { Modal } from "@dynatrace/strato-components/overlays";
import { Flex, Surface } from "@dynatrace/strato-components/layouts";
import { Paragraph } from "@dynatrace/strato-components/typography";
import { Chip } from "@dynatrace/strato-components/content";
import { SearchInput } from "@dynatrace/strato-components/forms";
import { CheckmarkIcon, ChevronRightIcon, ExtensionsIcon } from "@dynatrace/strato-icons";
import { openApp } from "@dynatrace-sdk/navigation";

interface Extension {
  id: string;
  name: string;
  description: string;
}

const FIREWALL_EXTENSIONS: Extension[] = [
  {
    id: "com.dynatrace.extension.palo-alto-generic",
    name: "Palo Alto Networks PAN-OS",
    description:
      "Monitor Palo Alto Networks firewalls with SNMP-based metrics for interfaces, sessions, tunnels, and threat prevention.",
  },
  {
    id: "com.dynatrace.extension.checkpoint-firewall",
    name: "Check Point Firewall",
    description:
      "Monitor Check Point firewall appliances with SNMP-based metrics for policy, connections, and threat prevention.",
  },
  {
    id: "com.dynatrace.extension.cisco-firepower",
    name: "Cisco Firepower",
    description:
      "Monitor Cisco Firepower Threat Defense appliances with SNMP-based metrics for interfaces, connections, and intrusion prevention.",
  },
];

interface ExpandMonitoringModalProps {
  show: boolean;
  onDismiss: () => void;
}

export const ExpandMonitoringModal = ({
  show,
  onDismiss,
}: ExpandMonitoringModalProps) => {
  const [search, setSearch] = useState("");

  const filtered = FIREWALL_EXTENSIONS.filter(
    (ext) =>
      ext.name.toLowerCase().includes(search.toLowerCase()) ||
      ext.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal title="Extensions" show={show} onDismiss={onDismiss} size="large">
      <Flex flexDirection="column" gap={16}>
        <SearchInput
          placeholder="Search"
          value={search}
          onChange={(val) => setSearch(val ?? "")}
        />
        <Flex flexDirection="column" gap={12}>
          {filtered.map((ext) => (
            <Surface
              key={ext.id}
              elevation="raised"
              style={{ cursor: "pointer", borderRadius: 8 }}
              onClick={() => openApp("dynatrace.hub", `extension/${ext.id}`)}
            >
              <Flex
                alignItems="center"
                gap={16}
                padding={20}
              >
                <Flex
                  alignItems="center"
                  justifyContent="center"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    backgroundColor: "var(--dt-colors-surfaces-secondary-default)",
                    flexShrink: 0,
                  }}
                >
                  <ExtensionsIcon size={24} />
                </Flex>
                <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
                  <Paragraph style={{ fontWeight: 600 }}>{ext.name}</Paragraph>
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
    </Modal>
  );
};
