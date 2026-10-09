import React, { useState } from "react";
import { NavLink, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { cn } from "../../lib/cn";

// ── Nav item type ─────────────────────────────────────────────────

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}

// ── Icons (inline SVG, no icon library dep) ───────────────────────

const DashboardIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);
const HospitalIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);
const AmbulanceIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);
const UsersIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const EmergencyIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);
const CasesIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);
const ProfileIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);
const ChevronLeftIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);
const MenuIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
const LogoutIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

// ── Nav config ────────────────────────────────────────────────────

const ADMIN_NAV: NavItem[] = [
  { to: "/admin/dashboard", label: "Dashboard", icon: <DashboardIcon />, end: true },
  { to: "/admin/hospitals", label: "Hospitals", icon: <HospitalIcon /> },
  { to: "/admin/ambulances", label: "Ambulances", icon: <AmbulanceIcon /> },
  { to: "/admin/users", label: "Users", icon: <UsersIcon /> },
  { to: "/admin/emergencies", label: "Emergencies", icon: <EmergencyIcon /> },
];

const HOSPITAL_NAV: NavItem[] = [
  { to: "/hospital/dashboard", label: "Dashboard", icon: <DashboardIcon />, end: true },
  { to: "/hospital/cases", label: "Cases", icon: <CasesIcon /> },
  { to: "/hospital/profile", label: "Profile", icon: <ProfileIcon /> },
];

// ── Sidebar nav item ──────────────────────────────────────────────

function SideNavItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          isActive
            ? "bg-primary text-white"
            : "text-navy-secondary hover:bg-surface-container hover:text-navy"
        )
      }
    >
      <span className="shrink-0">{item.icon}</span>
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────

function Sidebar({
  navItems,
  collapsed,
  onToggle,
}: {
  navItems: NavItem[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { user, logout } = useAuth();

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-outline-variant bg-white transition-all duration-200",
        collapsed ? "w-[56px]" : "w-[220px]"
      )}
    >
      {/* Logo / branding */}
      <div className="flex h-14 items-center border-b border-outline-variant px-3 shrink-0">
        {!collapsed && (
          <Link
            to="/"
            className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-white text-[11px] font-bold shrink-0">
              R
            </span>
            <span className="text-[15px] font-semibold text-navy tracking-tight">
              RESQ
            </span>
          </Link>
        )}
        {collapsed && (
          <span className="mx-auto flex h-7 w-7 items-center justify-center rounded bg-primary text-white text-[11px] font-bold">
            R
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav
        aria-label="Main navigation"
        className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5"
      >
        {navItems.map((item) => (
          <SideNavItem key={item.to} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* User section + collapse toggle */}
      <div className="shrink-0 border-t border-outline-variant px-2 py-2 space-y-1">
        {!collapsed && user && (
          <div className="px-2 py-1.5 rounded-md">
            <p className="text-[12px] font-medium text-navy truncate">{user.email}</p>
            <p className="text-[11px] text-navy-secondary capitalize">
              {user.role.replace("_", " ").toLowerCase()}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => logout()}
          title="Log out"
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-navy-secondary hover:bg-surface-container hover:text-[#ba1a1a] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            collapsed && "justify-center"
          )}
        >
          <LogoutIcon />
          {!collapsed && "Log out"}
        </button>
        <button
          type="button"
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-navy-secondary hover:bg-surface-container transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            collapsed && "justify-center"
          )}
        >
          <span className={cn("transition-transform", collapsed && "rotate-180")}>
            <ChevronLeftIcon />
          </span>
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}

// ── Top bar ───────────────────────────────────────────────────────

function TopBar({
  onMenuClick,
  pageTitle,
}: {
  onMenuClick: () => void;
  pageTitle?: string;
}) {
  const { user } = useAuth();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-outline-variant bg-white px-4">
      {/* Mobile hamburger */}
      <button
        type="button"
        className="sm:hidden rounded p-1 text-navy-secondary hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <MenuIcon />
      </button>

      <div className="flex-1" />

      {user && (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-navy-secondary hidden sm:block">
            {user.email}
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white text-[11px] font-bold uppercase">
            {user.email.charAt(0)}
          </span>
        </div>
      )}
    </header>
  );
}

// ── App Shell ─────────────────────────────────────────────────────

interface AppShellProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export function AppShell({ children, pageTitle }: AppShellProps) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems =
    user?.role === "ADMIN" ? ADMIN_NAV : user?.role === "HOSPITAL_STAFF" ? HOSPITAL_NAV : [];

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Desktop sidebar */}
      <div className="hidden sm:flex">
        <Sidebar
          navItems={navItems}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-navy/40 sm:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 sm:hidden">
            <Sidebar
              navItems={navItems}
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
            />
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          onMenuClick={() => setMobileOpen(true)}
          pageTitle={pageTitle}
        />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
