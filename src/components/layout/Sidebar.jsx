import { NavLink } from "react-router-dom";
import { appLogo, fallbackAppLogo } from "../../assets/logo";
import { getVisibleNavItems } from "./navigation";

export function Sidebar({ profile, collapsed = false, logoSrc = appLogo, logoAlt = "Roca Eterna Musica", logoInvert = false }) {
  const visibleName = profile?.preferredDisplayName || profile?.displayName || profile?.email;
  const navItems = getVisibleNavItems(profile?.role || "viewer");

  return (
    <aside className={`app-sidebar fixed left-0 top-0 hidden h-screen flex-col bg-ink p-5 text-white transition-all duration-200 lg:flex ${collapsed ? "w-20" : "w-72"}`}>
      <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
        <img
          src={logoSrc}
          onError={(event) => {
            event.currentTarget.src = fallbackAppLogo;
          }}
          alt={logoAlt}
          className={`h-12 w-12 rounded-2xl bg-white object-contain p-1 ${logoInvert ? "invert" : ""}`}
        />
        {!collapsed ? (
          <div>
            <p className="text-sm font-bold">Roca Eterna</p>
            <p className="text-xs text-white/55">Musica</p>
          </div>
        ) : null}
      </div>

      <nav className="mt-10 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            data-tour={item.tourId}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl py-3 text-sm font-semibold transition ${
                collapsed ? "justify-center px-0" : "px-4"
              } ${isActive ? "bg-white text-ink" : "text-white/68 hover:bg-white/8 hover:text-white"}`
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed ? item.label : null}
          </NavLink>
        ))}
      </nav>

      <div className={`mt-auto rounded-3xl border border-white/10 bg-white/7 ${collapsed ? "px-2 py-3 text-center" : "p-4"}`}>
        {!collapsed ? <p className="text-xs text-white/45">Sesion</p> : null}
        <p className={`mt-1 truncate text-sm font-semibold ${collapsed ? "sr-only" : ""}`}>{visibleName}</p>
        <p className="mt-2 inline-flex rounded-full bg-brass/20 px-2 py-1 text-xs font-semibold text-brass">
          {collapsed ? (profile?.role || "viewer").slice(0, 1).toUpperCase() : profile?.role || "viewer"}
        </p>
      </div>
    </aside>
  );
}
