import { NavLink } from "react-router-dom";
import { appLogo, fallbackAppLogo } from "../../assets/logo";
import { preloadRoutePath } from "../../services/routePreload";
import { requestRouteScrollReset } from "../../services/navigationMemory";
import { getVisibleNavItems } from "./navigation";

export function Sidebar({ profile, collapsed = false, logoSrc = appLogo, logoAlt = "Roca Eterna Música", logoMode = "light" }) {
  const visibleName = profile?.preferredDisplayName || profile?.displayName || profile?.email;
  const navItems = getVisibleNavItems(profile);

  return (
    <aside className={`app-sidebar fixed left-0 top-0 hidden h-screen flex-col bg-ink p-5 text-white transition-all duration-200 lg:flex ${collapsed ? "w-20" : "w-72"}`}>
      <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
        <img
          src={logoSrc}
          onError={(event) => {
            event.currentTarget.src = fallbackAppLogo;
          }}
          alt={logoAlt}
          className={`h-12 w-12 rounded-2xl object-contain p-1 ${logoMode === "dark" ? "bg-zinc-950" : "bg-white"}`}
        />
        {!collapsed ? (
          <div>
            <p className="text-sm font-bold">Roca Eterna</p>
            <p className="text-xs text-white/55">Música</p>
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
            onPointerEnter={() => preloadRoutePath(item.path)}
            onFocus={() => preloadRoutePath(item.path)}
            onTouchStart={() => preloadRoutePath(item.path)}
            onClick={() => {
              const currentPath = window.location.hash.replace(/^#/, "").split("?")[0];
              if (currentPath === item.path || currentPath.startsWith(`${item.path}/`)) {
                requestRouteScrollReset(item.path);
                if (currentPath === item.path) window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
              }
            }}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl py-3 text-sm font-semibold transition ${
                collapsed ? "justify-center px-0" : "px-4"
              } ${isActive ? "bg-white text-ink" : "text-white/68 hover:bg-white/8 hover:text-white"}`
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed ? <span className="min-w-0 flex-1">{item.label}</span> : null}
          </NavLink>
        ))}
      </nav>

      <div className={`mt-auto rounded-3xl border border-white/10 bg-white/7 ${collapsed ? "px-2 py-3 text-center" : "p-4"}`}>
        {!collapsed ? <p className="text-xs text-white/45">Sesión</p> : null}
        <p className={`mt-1 truncate text-sm font-semibold ${collapsed ? "sr-only" : ""}`}>{visibleName}</p>
        {profile?.role === "admin" ? (
          <p className="mt-2 inline-flex rounded-full bg-brass/20 px-2 py-1 text-xs font-semibold text-brass">
            {collapsed ? "A" : "admin"}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
