import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppHeader } from "@dynatrace/strato-components-preview/layouts";
import { PlusIcon } from "@dynatrace/strato-icons";

export const Header = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <AppHeader>
      <AppHeader.NavItems>
        <AppHeader.AppNavLink as={Link} to="/dashboard" />
        <AppHeader.NavItem as={Link} to="/dashboard" isSelected={pathname === "/dashboard" || pathname === "/"}>
          Overview
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/analyzer" isSelected={pathname === "/analyzer"}>
          Traffic Analyzer
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
          prefixIcon={<PlusIcon />}
          onClick={() => navigate("/setup")}
        >
          Add Logs
        </AppHeader.ActionButton>
      </AppHeader.ActionItems>
    </AppHeader>
  );
};
