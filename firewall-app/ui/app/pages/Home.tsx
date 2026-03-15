import React from "react";

import { useCurrentTheme } from "@dynatrace/strato-components/core";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { Card } from "../components/Card";

export const Home = () => {
  const theme = useCurrentTheme();
  return (
    <Flex flexDirection="column" alignItems="center" padding={32}>
      <img
        src="./assets/Dynatrace_Logo.svg"
        alt="Dynatrace Logo"
        width={150}
        height={150}
        style={{ paddingBottom: 32 }}
      ></img>

      <Heading>Palo Alto Firewall Log Analyzer</Heading>
      <Paragraph style={{ maxWidth: 640, textAlign: "center", marginTop: 8 }}>
        This app analyzes Palo Alto Networks PAN-OS traffic logs ingested into
        Dynatrace Grail. Use the Firewall Dashboard to explore traffic patterns,
        blocked sessions, top sources and destinations, high-risk port activity,
        and bandwidth usage across all firewall rules and zones. Use the Traffic
        Analyzer to investigate whether specific traffic is being blocked by
        entering a source IP, destination IP, or both — and see exactly which
        firewall rule and action caused the block.
      </Paragraph>

      <Flex gap={48} paddingTop={64} flexFlow="wrap">
        <Card
          href="/dashboard"
          inAppLink
          imgSrc={
            theme === "light" ? "./assets/data.png" : "./assets/data_dark.png"
          }
          name="Firewall Dashboard"
        />
        <Card
          href="/analyzer"
          inAppLink
          imgSrc={
            theme === "light"
              ? "./assets/devportal.png"
              : "./assets/devportal_dark.png"
          }
          name="Traffic Analyzer"
        />
      </Flex>
    </Flex>
  );
};
