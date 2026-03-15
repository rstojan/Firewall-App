import { Page } from "@dynatrace/strato-components-preview/layouts";
import React from "react";
import { Route, Routes } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { IngestionWizard } from "./pages/IngestionWizard";
import { TrafficAnalyzer } from "./pages/TrafficAnalyzer";
import { FirewallLogs } from "./pages/FirewallLogs";
import { Header } from "./components/Header";
import { Home } from "./pages/Home";

export const App = () => {
  return (
    <Page>
      <Page.Header>
        <Header />
      </Page.Header>
      <Page.Main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analyzer" element={<TrafficAnalyzer />} />
          <Route path="/setup" element={<IngestionWizard />} />
          <Route path="/logs" element={<FirewallLogs />} />
        </Routes>
      </Page.Main>
    </Page>
  );
};
