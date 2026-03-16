import { Page } from "@dynatrace/strato-components-preview/layouts";
import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { IngestionWizard } from "./pages/IngestionWizard";
import { TrafficAnalyzer } from "./pages/TrafficAnalyzer";
import { FirewallLogs } from "./pages/FirewallLogs";
import { Recommendations } from "./pages/Recommendations";
import { DeepAnalysis } from "./pages/DeepAnalysis";
import { Header } from "./components/Header";

export const App = () => {
  return (
    <Page>
      <Page.Header>
        <Header />
      </Page.Header>
      <Page.Main>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analyzer" element={<TrafficAnalyzer />} />
          <Route path="/setup" element={<IngestionWizard />} />
          <Route path="/logs" element={<FirewallLogs />} />
          <Route path="/deep-analysis" element={<DeepAnalysis />} />
          <Route path="/recommendations" element={<Recommendations />} />
        </Routes>
      </Page.Main>
    </Page>
  );
};
