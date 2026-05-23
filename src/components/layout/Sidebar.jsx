import { NavLink } from "react-router-dom";
import { appLogo, fallbackAppLogo } from "../../assets/logo";
import { getVisibleNavItems } from "./navigation";

export function Sidebar({ profile, collapsed = false, logoSrc = appLogo, logoAlt = "Roca Eterna Música", logoMode = "light" }) {
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
        {navItems.map((item) => {
          const isSmart = item.path === "/inteligente";
          return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            data-tour={item.tourId}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `relative flex items-center gap-3 overflow-hidden rounded-2xl py-3 text-sm font-semibold transition ${
                collapsed ? "justify-center px-0" : "px-4"
              } ${isActive ? (isSmart ? "bg-brass text-ink shadow-[0_0_24px_rgba(212,175,55,0.28)]" : "bg-white text-ink") : isSmart ? "border border-brass/25 bg-brass/10 text-brass hover:bg-brass/18" : "text-white/68 hover:bg-white/8 hover:text-white"}`
            }
          >
            {isSmart ? (
              <>
                <span className="pointer-events-none absolute right-3 top-2 h-1.5 w-1.5 animate-pulse rounded-full bg-brass" />
                <span className="pointer-events-none absolute bottom-2 right-8 h-1 w-1 animate-pulse rounded-full bg-white/80 [animation-delay:600ms]" />
              </>
            ) : null}
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed ? (
              <>
                <span className="min-w-0 flex-1">{item.label}</span>
                {isSmart ? <span className="rounded-full bg-brass/20 px-2 py-0.5 text-[10px] font-black text-brass">IA</span> : null}
              </>
            ) : null}
          </NavLink>
        );})}
      </nav>

      <div className={`mt-auto rounded-3xl border border-white/10 bg-white/7 ${collapsed ? "px-2 py-3 text-center" : "p-4"}`}>
        {!collapsed ? <p className="text-xs text-white/45">Sesión</p> : null}
        <p className={`mt-1 truncate text-sm font-semibold ${collapsed ? "sr-only" : ""}`}>{visibleName}</p>
        <p className="mt-2 inline-flex rounded-full bg-brass/20 px-2 py-1 text-xs font-semibold text-brass">
          {collapsed ? (profile?.role || "viewer").slice(0, 1).toUpperCase() : profile?.role || "viewer"}
        </p>
      </div>
    </aside>
  );
}
