import React, { useState } from "react";

import { Flex, Surface } from "@dynatrace/strato-components/layouts";
import { Divider } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Strong, Text } from "@dynatrace/strato-components/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { ProgressBar } from "@dynatrace/strato-components/content";
import { CodeSnippet } from "@dynatrace/strato-components-preview/content";
import { MessageContainer } from "@dynatrace/strato-components-preview/content";
import Colors from "@dynatrace/strato-design-tokens/colors";
import {
  CheckmarkIcon,
  NetworkIcon,
  LogsIcon,
  SecurityIcon,
  UploadIcon,
  SuccessIcon,
} from "@dynatrace/strato-icons";

// ─── Step definitions ────────────────────────────────────────────────────────

const STEPS = [
  { id: 0, label: "Overview",         icon: <UploadIcon /> },
  { id: 1, label: "ActiveGate Setup", icon: <NetworkIcon /> },
  { id: 2, label: "Syslog Profile",   icon: <SecurityIcon /> },
  { id: 3, label: "Log Forwarding",   icon: <LogsIcon /> },
  { id: 4, label: "Verify Ingestion", icon: <SuccessIcon /> },
];

// ─── Step content ────────────────────────────────────────────────────────────

const StepOverview = () => (
  <Flex flexDirection="column" gap={16}>
    <Heading level={2}>Ingest Palo Alto Firewall Logs into Dynatrace</Heading>
    <Paragraph>
      This wizard walks you through configuring your Palo Alto Networks firewall
      to forward syslog traffic logs to Dynatrace via an ActiveGate running the
      Generic Log Ingestion extension. Once set up, logs will be stored in Grail
      with structured <Strong>paloalto.*</Strong> attributes and available for
      DQL queries in this app.
    </Paragraph>

    <Heading level={3}>How it works</Heading>
    <Paragraph>
      The Palo Alto firewall forwards syslog messages over UDP or TCP to a
      Dynatrace ActiveGate. The ActiveGate parses the PAN-OS log format, extracts
      structured fields, and ingests the records into Grail tagged with{" "}
      <Strong>log.source = "palo-alto-firewall"</Strong>.
    </Paragraph>

    <MessageContainer variant="primary">
      <MessageContainer.Title>Architecture overview</MessageContainer.Title>
      <MessageContainer.Description>
        Palo Alto Firewall → Syslog (UDP/TCP 514) → Dynatrace ActiveGate → Grail
      </MessageContainer.Description>
    </MessageContainer>

    <Heading level={3}>Prerequisites</Heading>
    <Flex flexDirection="column" gap={8}>
      {[
        "A Dynatrace environment with Grail enabled (SaaS or Managed)",
        "A Linux host reachable from the firewall to run the ActiveGate",
        "Administrative access to the Palo Alto firewall management UI or CLI",
        "Outbound HTTPS access from the ActiveGate host to your Dynatrace environment",
        "UDP or TCP port 514 open from the firewall to the ActiveGate host",
      ].map((item, i) => (
        <Flex key={i} alignItems="flex-start" gap={8}>
          <CheckmarkIcon style={{ color: Colors.Text.Success.Default, flexShrink: 0, marginTop: 2 }} />
          <Paragraph>{item}</Paragraph>
        </Flex>
      ))}
    </Flex>

    <Heading level={3}>Estimated time</Heading>
    <Paragraph>20 – 30 minutes</Paragraph>
  </Flex>
);

const StepActiveGate = () => (
  <Flex flexDirection="column" gap={16}>
    <Heading level={2}>Step 1 — Install and Configure the ActiveGate</Heading>
    <Paragraph>
      The Dynatrace ActiveGate acts as the syslog receiver. Install it on a
      Linux host that is network-reachable from your Palo Alto firewall on port
      514.
    </Paragraph>

    <Heading level={3}>1.1 Install the ActiveGate</Heading>
    <Paragraph>
      In your Dynatrace environment, navigate to{" "}
      <Strong>Infrastructure → ActiveGates → Install ActiveGate</Strong> and
      download the installer for your Linux distribution. Then run:
    </Paragraph>
    <CodeSnippet language="bash" showLineNumbers={false}>
      {`# Make the installer executable and run it
chmod +x dynatrace-activegate-*.sh
sudo ./dynatrace-activegate-*.sh`}
    </CodeSnippet>

    <Heading level={3}>1.2 Enable the Generic Log Ingestion extension</Heading>
    <Paragraph>
      Edit the ActiveGate configuration file to enable the log ingestion
      capability:
    </Paragraph>
    <CodeSnippet language="bash" showLineNumbers={false}>
      {`sudo vi /var/lib/dynatrace/gateway/config/custom.properties`}
    </CodeSnippet>
    <Paragraph>Add or uncomment the following lines:</Paragraph>
    <CodeSnippet language="bash" showLineNumbers={false}>
      {`[collector]
# Enable syslog receiver
syslog.enabled=true
syslog.port=514
syslog.protocol=udp`}
    </CodeSnippet>

    <MessageContainer variant="warning">
      <MessageContainer.Title>UDP vs TCP</MessageContainer.Title>
      <MessageContainer.Description>
        UDP (default) is simpler to configure but does not guarantee delivery.
        For production environments, consider using TCP by setting{" "}
        <Strong>syslog.protocol=tcp</Strong> and configuring TCP syslog on the
        firewall side.
      </MessageContainer.Description>
    </MessageContainer>

    <Heading level={3}>1.3 Restart the ActiveGate</Heading>
    <CodeSnippet language="bash" showLineNumbers={false}>
      {`sudo systemctl restart dynatracegateway`}
    </CodeSnippet>

    <Heading level={3}>1.4 Configure the log source attribute</Heading>
    <Paragraph>
      To ensure logs are tagged correctly for this app, configure a log source
      enrichment rule in your Dynatrace environment:
    </Paragraph>
    <Paragraph>
      Navigate to <Strong>Settings → Log Monitoring → Log sources and storage</Strong>.
      Add a custom attribute rule that sets{" "}
      <Strong>log.source = "palo-alto-firewall"</Strong> for traffic matching
      your ActiveGate's syslog source IP.
    </Paragraph>

    <MessageContainer variant="primary">
      <MessageContainer.Title>Note your ActiveGate IP</MessageContainer.Title>
      <MessageContainer.Description>
        Record the IP address of this host — you will need it in the next step
        when configuring the firewall syslog destination.
      </MessageContainer.Description>
    </MessageContainer>
  </Flex>
);

const StepSyslogProfile = () => (
  <Flex flexDirection="column" gap={16}>
    <Heading level={2}>Step 2 — Create a Syslog Server Profile on the Firewall</Heading>
    <Paragraph>
      A Syslog Server Profile tells the Palo Alto firewall where to send log
      messages and in what format. Configure this via the management UI or CLI.
    </Paragraph>

    <Heading level={3}>Via Management UI (Panorama or firewall web interface)</Heading>
    <Flex flexDirection="column" gap={6}>
      {[
        'Navigate to Device → Server Profiles → Syslog',
        'Click Add to create a new profile',
        'Name it: dynatrace-syslog',
        'Under Servers, click Add and fill in the fields below',
        'Click OK and then Commit',
      ].map((step, i) => (
        <Flex key={i} gap={8} alignItems="flex-start">
          <Flex
            style={{
              minWidth: 24,
              height: 24,
              borderRadius: "50%",
              background: Colors.Background.Container.Primary.Default,
              color: Colors.Text.Primary.Default,
              fontWeight: "bold",
              fontSize: 12,
            }}
            alignItems="center"
            justifyContent="center"
          >
            {i + 1}
          </Flex>
          <Paragraph style={{ marginTop: 2 }}>{step}</Paragraph>
        </Flex>
      ))}
    </Flex>

    <Heading level={3}>Syslog Server settings</Heading>
    <Surface style={{ padding: 16 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${Colors.Border.Neutral.Default}` }}>
            <th style={{ textAlign: "left", padding: "6px 12px" }}>Field</th>
            <th style={{ textAlign: "left", padding: "6px 12px" }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Name", "dynatrace"],
            ["Syslog Server (IP)", "<ActiveGate IP address>"],
            ["Transport", "UDP (or TCP)"],
            ["Port", "514"],
            ["Format", "BSD"],
            ["Facility", "LOG_USER"],
          ].map(([field, value]) => (
            <tr key={field} style={{ borderBottom: `1px solid ${Colors.Border.Neutral.Default}` }}>
              <td style={{ padding: "6px 12px" }}><Strong>{field}</Strong></td>
              <td style={{ padding: "6px 12px", fontFamily: "monospace" }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>

    <Heading level={3}>Via CLI</Heading>
    <CodeSnippet language="bash" showLineNumbers={false}>
      {`# Enter configuration mode
configure

# Create the syslog server profile
set shared log-fwd-card syslog dynatrace-syslog server dynatrace address <ActiveGate-IP>
set shared log-fwd-card syslog dynatrace-syslog server dynatrace transport UDP
set shared log-fwd-card syslog dynatrace-syslog server dynatrace port 514
set shared log-fwd-card syslog dynatrace-syslog server dynatrace format BSD
set shared log-fwd-card syslog dynatrace-syslog server dynatrace facility LOG_USER

# Commit
commit`}
    </CodeSnippet>

    <Heading level={3}>Configure log format (Traffic logs)</Heading>
    <Paragraph>
      Under the syslog profile, configure the <Strong>Custom Log Format</Strong>{" "}
      for Traffic logs to use the PAN-OS default CSV format. In the management
      UI go to <Strong>Device → Server Profiles → Syslog → [your profile] → Custom Log Format</Strong>{" "}
      and set the Traffic format to:
    </Paragraph>
    <CodeSnippet language="bash" showLineNumbers={false}>
      {`$receive_time,$serial,$type,$subtype,,$time_generated,$src,$dst,$natsrc,$natdst,$rule,$srcuser,$dstuser,$app,$vsys,$from,$to,$inbound_if,$outbound_if,$logset,,$sessionid,$repeatcnt,$sport,$dport,$natsport,$natdport,$flags,$proto,$action,$bytes,$bytes_sent,$bytes_received,$packets,$start,$elapsed,$category`}
    </CodeSnippet>

    <MessageContainer variant="neutral">
      <MessageContainer.Title>Default format is fine</MessageContainer.Title>
      <MessageContainer.Description>
        If you leave the format blank, the firewall uses the default PAN-OS CSV
        format, which this app's DQL queries are designed to parse. Only
        customize this if your environment requires a different field ordering.
      </MessageContainer.Description>
    </MessageContainer>
  </Flex>
);

const StepLogForwarding = () => (
  <Flex flexDirection="column" gap={16}>
    <Heading level={2}>Step 3 — Configure Log Forwarding on Security Policies</Heading>
    <Paragraph>
      Now attach the syslog profile to a <Strong>Log Forwarding Profile</Strong>{" "}
      and apply it to your security policies so that traffic log events are sent
      to Dynatrace.
    </Paragraph>

    <Heading level={3}>3.1 Create a Log Forwarding Profile</Heading>
    <Flex flexDirection="column" gap={6}>
      {[
        "Navigate to Objects → Log Forwarding",
        "Click Add to create a new profile",
        'Name it: dynatrace-log-forwarding',
        "Click Add under the profile to create a match list",
        "Set Log Type to traffic",
        "Set Syslog to dynatrace-syslog (the profile from Step 2)",
        "Click OK and then Commit",
      ].map((step, i) => (
        <Flex key={i} gap={8} alignItems="flex-start">
          <Flex
            style={{
              minWidth: 24,
              height: 24,
              borderRadius: "50%",
              background: Colors.Background.Container.Primary.Default,
              color: Colors.Text.Primary.Default,
              fontWeight: "bold",
              fontSize: 12,
            }}
            alignItems="center"
            justifyContent="center"
          >
            {i + 1}
          </Flex>
          <Paragraph style={{ marginTop: 2 }}>{step}</Paragraph>
        </Flex>
      ))}
    </Flex>

    <Heading level={3}>3.2 Apply the profile to security policies</Heading>
    <Paragraph>
      Edit each security policy rule that you want to monitor:
    </Paragraph>
    <Flex flexDirection="column" gap={6}>
      {[
        "Navigate to Policies → Security",
        "Edit the desired rule",
        "Go to the Actions tab",
        "Set Log Forwarding to dynatrace-log-forwarding",
        'Enable Log at Session Start and/or Log at Session End as needed',
        "Click OK and Commit",
      ].map((step, i) => (
        <Flex key={i} gap={8} alignItems="flex-start">
          <Flex
            style={{
              minWidth: 24,
              height: 24,
              borderRadius: "50%",
              background: Colors.Background.Container.Primary.Default,
              color: Colors.Text.Primary.Default,
              fontWeight: "bold",
              fontSize: 12,
            }}
            alignItems="center"
            justifyContent="center"
          >
            {i + 1}
          </Flex>
          <Paragraph style={{ marginTop: 2 }}>{step}</Paragraph>
        </Flex>
      ))}
    </Flex>

    <Heading level={3}>Via CLI</Heading>
    <CodeSnippet language="bash" showLineNumbers={false}>
      {`# Enter configuration mode
configure

# Create a log forwarding profile
set shared log-fwd-profile dynatrace-log-forwarding match-list traffic-to-dynatrace log-type traffic
set shared log-fwd-profile dynatrace-log-forwarding match-list traffic-to-dynatrace send-syslog dynatrace-syslog

# Apply the profile to a security rule (replace "your-rule-name" with the actual rule)
set rulebase security rules "your-rule-name" log-setting dynatrace-log-forwarding

# Enable session-end logging on the rule
set rulebase security rules "your-rule-name" log-end yes

# Commit
commit`}
    </CodeSnippet>

    <MessageContainer variant="warning">
      <MessageContainer.Title>Apply to all relevant rules</MessageContainer.Title>
      <MessageContainer.Description>
        Repeat the policy assignment for every security rule whose traffic you
        want to monitor. Rules without a log forwarding profile will not send
        any events to Dynatrace.
      </MessageContainer.Description>
    </MessageContainer>

    <Heading level={3}>3.3 (Optional) Forward threat and URL logs</Heading>
    <Paragraph>
      To also capture threat and URL filtering events, add additional match list
      entries to the forwarding profile with <Strong>log-type threat</Strong> and{" "}
      <Strong>log-type url</Strong>, pointing to the same syslog profile.
    </Paragraph>
    <CodeSnippet language="bash" showLineNumbers={false}>
      {`set shared log-fwd-profile dynatrace-log-forwarding match-list threats-to-dynatrace log-type threat
set shared log-fwd-profile dynatrace-log-forwarding match-list threats-to-dynatrace send-syslog dynatrace-syslog
commit`}
    </CodeSnippet>
  </Flex>
);

const StepVerify = () => (
  <Flex flexDirection="column" gap={16}>
    <Heading level={2}>Step 4 — Verify Log Ingestion in Dynatrace</Heading>
    <Paragraph>
      Generate some traffic through the firewall (or wait for existing traffic
      to be logged), then verify that records are arriving in Grail.
    </Paragraph>

    <Heading level={3}>4.1 Check for incoming logs</Heading>
    <Paragraph>
      Run the following DQL query in the Dynatrace Notebooks or Log Viewer to
      confirm logs are being received:
    </Paragraph>
    <CodeSnippet language="dql" showLineNumbers={false}>
      {`fetch logs
| filter log.source == "palo-alto-firewall"
| sort timestamp desc
| limit 20`}
    </CodeSnippet>
    <Paragraph>
      You should see recent log records with <Strong>paloalto.*</Strong>{" "}
      attributes populated. If no records appear, work through the
      troubleshooting steps below.
    </Paragraph>

    <Heading level={3}>4.2 Confirm structured attributes</Heading>
    <Paragraph>
      Verify that the key fields are being parsed correctly:
    </Paragraph>
    <CodeSnippet language="dql" showLineNumbers={false}>
      {`fetch logs
| filter log.source == "palo-alto-firewall"
| fields timestamp,
         paloalto.action,
         paloalto.src,
         paloalto.dst,
         paloalto.app,
         paloalto.rule,
         paloalto.from_zone,
         paloalto.to_zone,
         paloalto.dport
| sort timestamp desc
| limit 10`}
    </CodeSnippet>

    <Heading level={3}>4.3 Confirm allow vs. block split</Heading>
    <CodeSnippet language="dql" showLineNumbers={false}>
      {`fetch logs
| filter log.source == "palo-alto-firewall"
| summarize total = count(),
            allowed = countIf(paloalto.action == "allow"),
            blocked = countIf(paloalto.action != "allow"),
            by: { paloalto.action }
| sort total desc`}
    </CodeSnippet>

    <Heading level={3}>Troubleshooting</Heading>
    <Flex flexDirection="column" gap={12}>
      <Surface style={{ padding: 16 }}>
        <Paragraph><Strong>No logs appearing in Grail</Strong></Paragraph>
        <Flex flexDirection="column" gap={4} style={{ marginTop: 6 }}>
          {[
            "Confirm port 514 is open from the firewall to the ActiveGate host (firewall, OS, and cloud security group rules)",
            "Verify the ActiveGate syslog receiver is running: sudo systemctl status dynatracegateway",
            "Check ActiveGate logs for ingestion errors: /var/log/dynatrace/gateway/",
            "Run a packet capture on the ActiveGate host to confirm UDP/TCP traffic is arriving: sudo tcpdump -i any port 514",
          ].map((tip, i) => (
            <Flex key={i} alignItems="flex-start" gap={8}>
              <Text style={{ color: Colors.Text.Neutral.Subdued, flexShrink: 0 }}>•</Text>
              <Paragraph>{tip}</Paragraph>
            </Flex>
          ))}
        </Flex>
      </Surface>

      <Surface style={{ padding: 16 }}>
        <Paragraph><Strong>Logs arriving but paloalto.* attributes are missing</Strong></Paragraph>
        <Flex flexDirection="column" gap={4} style={{ marginTop: 6 }}>
          {[
            "Check that the syslog format on the firewall matches the expected PAN-OS CSV layout",
            "Confirm the log.source attribute is correctly set to \"palo-alto-firewall\" in the log enrichment rules",
            "Inspect the raw log content field using: fetch logs | filter log.source == \"palo-alto-firewall\" | fields content | limit 5",
          ].map((tip, i) => (
            <Flex key={i} alignItems="flex-start" gap={8}>
              <Text style={{ color: Colors.Text.Neutral.Subdued, flexShrink: 0 }}>•</Text>
              <Paragraph>{tip}</Paragraph>
            </Flex>
          ))}
        </Flex>
      </Surface>

      <Surface style={{ padding: 16 }}>
        <Paragraph><Strong>Logs arriving with delay</Strong></Paragraph>
        <Flex flexDirection="column" gap={4} style={{ marginTop: 6 }}>
          {[
            "Grail ingestion is near-real-time but may have a 30–60 second delay",
            "Confirm the firewall commit was successful after applying the log forwarding profile",
            "Check if log-end is enabled on the security rule — sessions must end before traffic logs are emitted",
          ].map((tip, i) => (
            <Flex key={i} alignItems="flex-start" gap={8}>
              <Text style={{ color: Colors.Text.Neutral.Subdued, flexShrink: 0 }}>•</Text>
              <Paragraph>{tip}</Paragraph>
            </Flex>
          ))}
        </Flex>
      </Surface>
    </Flex>

    <MessageContainer variant="success">
      <MessageContainer.Title>Setup complete</MessageContainer.Title>
      <MessageContainer.Description>
        Once logs are confirmed in Grail, head to the Firewall Dashboard to
        explore traffic patterns, or use the Traffic Analyzer to investigate
        specific source and destination IP pairs.
      </MessageContainer.Description>
    </MessageContainer>
  </Flex>
);

const STEP_CONTENT = [
  <StepOverview />,
  <StepActiveGate />,
  <StepSyslogProfile />,
  <StepLogForwarding />,
  <StepVerify />,
];

// ─── Step indicator ──────────────────────────────────────────────────────────

interface StepIndicatorProps {
  steps: typeof STEPS;
  currentStep: number;
  onStepClick: (i: number) => void;
}

const StepIndicator = ({ steps, currentStep, onStepClick }: StepIndicatorProps) => (
  <Flex flexDirection="column" gap={4} style={{ minWidth: 200 }}>
    {steps.map((step) => {
      const done = step.id < currentStep;
      const active = step.id === currentStep;
      return (
        <button
          key={step.id}
          onClick={() => onStepClick(step.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            background: active
              ? Colors.Background.Container.Primary.Default
              : "transparent",
            color: active
              ? Colors.Text.Primary.Default
              : done
              ? Colors.Text.Success.Default
              : Colors.Text.Neutral.Subdued,
            fontWeight: active ? "bold" : "normal",
          }}
        >
          <Flex
            alignItems="center"
            justifyContent="center"
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              flexShrink: 0,
              background: active
                ? Colors.Background.Container.Primary.Emphasized
                : done
                ? Colors.Background.Container.Success?.Default ?? Colors.Background.Container.Neutral.Default
                : Colors.Background.Container.Neutral.Default,
              color: active
                ? Colors.Text.Primary.Default
                : done
                ? Colors.Text.Success.Default
                : Colors.Text.Neutral.Default,
            }}
          >
            {done ? <CheckmarkIcon /> : step.icon}
          </Flex>
          <Text style={{ fontSize: 14 }}>{step.label}</Text>
        </button>
      );
    })}
  </Flex>
);

// ─── Page ────────────────────────────────────────────────────────────────────

export const IngestionWizard = () => {
  const [currentStep, setCurrentStep] = useState(0);

  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;
  const progress = Math.round((currentStep / (STEPS.length - 1)) * 100);

  return (
    <Flex flexDirection="column" padding={32} gap={20}>
      <Flex flexDirection="column" gap={4}>
        <Heading level={1}>Syslog Ingestion Setup</Heading>
        <Paragraph style={{ color: Colors.Text.Neutral.Subdued }}>
          Configure Palo Alto Networks PAN-OS to forward firewall logs into
          Dynatrace Grail
        </Paragraph>
      </Flex>

      <Flex alignItems="center" gap={12}>
        <Text style={{ fontSize: 13, color: Colors.Text.Neutral.Subdued, whiteSpace: "nowrap" }}>
          Step {currentStep + 1} of {STEPS.length}
        </Text>
        <ProgressBar value={progress} max={100} style={{ flex: 1 }} />
        <Text style={{ fontSize: 13, color: Colors.Text.Neutral.Subdued, whiteSpace: "nowrap" }}>
          {progress}%
        </Text>
      </Flex>

      <Flex gap={24} alignItems="flex-start">
        {/* Sidebar */}
        <Surface style={{ padding: 12, minWidth: 220, flexShrink: 0 }}>
          <StepIndicator
            steps={STEPS}
            currentStep={currentStep}
            onStepClick={setCurrentStep}
          />
        </Surface>

        {/* Main content */}
        <Surface style={{ padding: 32, flex: 1, minWidth: 0 }}>
          {STEP_CONTENT[currentStep]}

          <Divider style={{ marginTop: 32, marginBottom: 20 }} />

          <Flex justifyContent="space-between">
            <Button
              variant="default"
              onClick={() => setCurrentStep((s) => s - 1)}
              disabled={isFirst}
            >
              Back
            </Button>
            {!isLast ? (
              <Button
                variant="accent"
                onClick={() => setCurrentStep((s) => s + 1)}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="accent"
                onClick={() => setCurrentStep(0)}
              >
                Start over
              </Button>
            )}
          </Flex>
        </Surface>
      </Flex>
    </Flex>
  );
};
