import React from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@dynatrace/strato-components-preview/layouts";

export const Header = () => {
  return (
    <AppHeader>
      <AppHeader.NavItems>
        <AppHeader.AppNavLink as={Link} to="/" />
        <AppHeader.NavItem as={Link} to="/setup">
          Setup Guide
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/dashboard">
          Firewall Dashboard
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/analyzer">
          Traffic Analyzer
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/logs">
          Firewall Logs
        </AppHeader.NavItem>
      </AppHeader.NavItems>
    </AppHeader>
  );
};
