import React, { useEffect, useState } from "react";
import { Modal } from "@dynatrace/strato-components/overlays";
import { Flex, Surface, Divider } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { Chip } from "@dynatrace/strato-components/content";
import { SearchInput } from "@dynatrace/strato-components/forms";
import { Button } from "@dynatrace/strato-components/buttons";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import {
  ChevronRightIcon,
  ChevronLeftIcon,
  ExtensionsIcon,
  ExternalLinkIcon,
} from "@dynatrace/strato-icons";
import { openApp } from "@dynatrace-sdk/navigation";
import { httpClient } from "@dynatrace-sdk/http-client";

const EXTENSION_IDS = [
  "com.dynatrace.extension.palo-alto-generic",
  "com.dynatrace.extension.checkpoint-firewall",
  "com.dynatrace.extension.cisco-firepower",
];

interface HubItem {
  id: string;
  name: string;
  description: string;
  comingSoon: boolean;
  screenshots?: string[];
  logo?: string;
}

async function fetchHubItems(): Promise<HubItem[]> {
  const items: HubItem[] = [];
  for (const id of EXTENSION_IDS) {
    try {
      const resp = await httpClient.send({
        url: `/platform/classic/environment-api/v2/hub/items/${id}`,
      });
      const data = await resp.body();
      items.push({
        id: data.artifactId ?? id,
        name: data.name ?? id,
        description: data.description ?? "",
        comingSoon: data.comingSoon ?? false,
        screenshots: data.screenshots ?? [],
        logo: data.logo ?? undefined,
      });
    } catch {
      items.push({
        id,
        name: id.replace("com.dynatrace.extension.", "").replace(/-/g, " "),
        description: "Unable to load details from Hub.",
        comingSoon: false,
      });
    }
  }
  return items;
}

interface ExpandMonitoringModalProps {
  show: boolean;
  onDismiss: () => void;
}

export const ExpandMonitoringModal = ({
  show,
  onDismiss,
}: ExpandMonitoringModalProps) => {
  const [search, setSearch] = useState("");
  const [selectedExt, setSelectedExt] = useState<HubItem | null>(null);
  const [extensions, setExtensions] = useState<HubItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (show && !loaded) {
      setLoading(true);
      fetchHubItems()
        .then(setExtensions)
        .finally(() => {
          setLoading(false);
          setLoaded(true);
        });
    }
  }, [show, loaded]);

  const filtered = extensions.filter(
    (ext) =>
      ext.name.toLowerCase().includes(search.toLowerCase()) ||
      ext.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleDismiss = () => {
    setSelectedExt(null);
    setSearch("");
    onDismiss();
  };

  const handleBack = () => {
    setSelectedExt(null);
  };

  return (
    <Modal
      title={selectedExt ? selectedExt.name : "Extensions"}
      show={show}
      onDismiss={handleDismiss}
      size="large"
    >
      {selectedExt ? (
        <Flex flexDirection="column" gap={20}>
          {/* Back button */}
          <Button variant="default" onClick={handleBack}>
            <Button.Prefix>
              <ChevronLeftIcon />
            </Button.Prefix>
            Back to extensions
          </Button>

          {/* Header: icon + name + Add to environment */}
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
              {selectedExt.logo ? (
                <img
                  src={selectedExt.logo}
                  alt={selectedExt.name}
                  style={{ width: 40, height: 40, objectFit: "contain" }}
                />
              ) : (
                <ExtensionsIcon size={28} />
              )}
            </Flex>
            <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
              <Heading level={5}>{selectedExt.name}</Heading>
            </Flex>
            <Button
              variant="emphasized"
              onClick={() =>
                openApp("dynatrace.hub", `extension/${selectedExt.id}`)
              }
            >
              Add to environment
            </Button>
          </Flex>

          {/* Screenshots */}
          {selectedExt.screenshots && selectedExt.screenshots.length > 0 && (
            <Flex
              gap={12}
              style={{
                overflowX: "auto",
                paddingBottom: 8,
              }}
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
                  />
                </Surface>
              ))}
            </Flex>
          )}

          <Divider />

          {/* Overview */}
          <Flex flexDirection="column" gap={8}>
            <Heading level={6}>Overview</Heading>
            <Paragraph>{selectedExt.description}</Paragraph>
          </Flex>
        </Flex>
      ) : (
        <Flex flexDirection="column" gap={16}>
          <SearchInput
            placeholder="Search"
            value={search}
            onChange={(val) => setSearch(val ?? "")}
          />
          {loading ? (
            <Flex justifyContent="center" padding={32}>
              <ProgressCircle />
            </Flex>
          ) : (
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
                      {ext.logo ? (
                        <img
                          src={ext.logo}
                          alt={ext.name}
                          style={{
                            width: 32,
                            height: 32,
                            objectFit: "contain",
                          }}
                        />
                      ) : (
                        <ExtensionsIcon size={24} />
                      )}
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
              {filtered.length === 0 && !loading && (
                <Paragraph>No extensions match your search.</Paragraph>
              )}
            </Flex>
          )}
        </Flex>
      )}
    </Modal>
  );
};
