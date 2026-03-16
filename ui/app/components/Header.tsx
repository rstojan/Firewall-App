import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppHeader } from "@dynatrace/strato-components-preview/layouts";
import { PlusIcon, ExtensionsIcon } from "@dynatrace/strato-icons";
import { ExpandMonitoringModal } from "./ExpandMonitoringModal";

export const Header = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [showExtensions, setShowExtensions] = useState(false);

  return (
    <>
      <AppHeader>
        <AppHeader.NavItems>
          <AppHeader.AppNavLink as={Link} to="/dashboard" />
          <AppHeader.NavItem as={Link} to="/dashboard" isSelected={pathname === "/dashboard" || pathname === "/"}>
            Overview
          </AppHeader.NavItem>
          <AppHeader.NavItem as={Link} to="/analyzer" isSelected={pathname === "/analyzer"}>
            Traffic Analyzer
          </AppHeader.NavItem>
          <AppHeader.NavItem as={Link} to="/deep-analysis" isSelected={pathname === "/deep-analysis"}>
            Deep Analysis
          </AppHeader.NavItem>
          <AppHeader.NavItem as={Link} to="/logs" isSelected={pathname === "/logs"}>
            Firewall Logs
          </AppHeader.NavItem>
          <AppHeader.NavItem as={Link} to="/recommendations" isSelected={pathname === "/recommendations"}>
            Recommendations
          </AppHeader.NavItem>
        </AppHeader.NavItems>
        <AppHeader.ActionItems>
          <AppHeader.ActionButton
            prefixIcon={<ExtensionsIcon />}
            onClick={() => setShowExtensions(true)}
          >
            Expand Monitoring
          </AppHeader.ActionButton>
          <AppHeader.ActionButton
            prefixIcon={<PlusIcon />}
            onClick={() => navigate("/setup")}
          >
            Add Logs
          </AppHeader.ActionButton>
        </AppHeader.ActionItems>
      </AppHeader>
      <ExpandMonitoringModal
        show={showExtensions}
        onDismiss={() => setShowExtensions(false)}
      />
    </>
  );
};
