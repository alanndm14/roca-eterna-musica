import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { HelpCircle, LogOut, MoreHorizontal, X } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { getMobileExtraItems, getMobilePrimaryItems } from "./navigation";
import { Button } from "../ui/Button";
import { preloadRoutePath } from "../../services/routePreload";
import { requestRouteScrollReset } from "../../services/navigationMemory";

export function BottomNav({ onNavigate }) {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const mobilePrimaryItems = getMobilePrimaryItems(profile);
  const mobileExtraItems = getMobileExtraItems(profile);
  const showMore = mobileExtraItems.length > 0;
  const isMoreActive = mobileExtraItems.some((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));

  const openGuide = () => {
    window.dispatchEvent(new Event("roca-eterna-open-guide"));
    setOpen(false);
  };

  return (
    <>
      {open && showMore ? (
        <div className="fixed inset-0 z-40 bg-ink/35 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute bottom-20 left-3 right-3 rounded-3xl border border-ink/10 bg-white p-4 shadow-2xl dark:border-white/12 dark:bg-zinc-950" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-ink">Más</h2>
              <Button variant="subtle" className="h-10 w-10 px-0" onClick={() => setOpen(false)} aria-label="Cerrar menú">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-2">
              {mobileExtraItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  data-tour={item.tourId}
                  onClick={(event) => {
                    if (onNavigate) {
                      onNavigate(event, item.path);
                      setOpen(false);
                      return;
                    }
                    if (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)) {
                      requestRouteScrollReset(item.path);
                      if (location.pathname === item.path) window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
                    }
                    setOpen(false);
                  }}
                  onPointerEnter={() => preloadRoutePath(item.path)}
                  onFocus={() => preloadRoutePath(item.path)}
                  onTouchStart={() => preloadRoutePath(item.path)}
                  className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-semibold transition ${isActive ? "bg-ink text-white" : "bg-ink/5 text-ink"}`}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="flex-1">{item.label}</span>
                </NavLink>
              ))}
              <button type="button" onClick={openGuide} className="flex min-h-12 items-center gap-3 rounded-2xl bg-ink/5 px-4 text-left text-sm font-semibold text-ink">
                <HelpCircle className="h-5 w-5" />
                Guía de uso
              </button>
              <button type="button" onClick={signOut} className="flex min-h-12 items-center gap-3 rounded-2xl bg-red-50 px-4 text-left text-sm font-semibold text-red-700">
                <LogOut className="h-5 w-5" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <nav className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 border-t border-ink/10 px-2 pb-2 pt-1 lg:hidden">
        <div
          className="mx-auto grid max-w-xl gap-1"
          style={{ gridTemplateColumns: `repeat(${mobilePrimaryItems.length + (showMore ? 1 : 0)}, minmax(0, 1fr))` }}
        >
          {mobilePrimaryItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              data-tour={item.tourId}
              onPointerEnter={() => preloadRoutePath(item.path)}
              onFocus={() => preloadRoutePath(item.path)}
              onTouchStart={() => preloadRoutePath(item.path)}
              onClick={(event) => {
                if (onNavigate) {
                  onNavigate(event, item.path);
                  return;
                }
                if (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)) {
                  requestRouteScrollReset(item.path);
                  if (location.pathname === item.path) window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
                }
              }}
              className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition ${isActive ? "bg-ink text-white" : "text-ink/55"}`}
            >
              <item.icon className="h-5 w-5" />
              <span className="max-w-full truncate px-0.5">{item.label}</span>
            </NavLink>
          ))}
          {showMore ? <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition ${isMoreActive || open ? "bg-ink text-white" : "text-ink/55"}`}
          >
            <MoreHorizontal className="h-5 w-5" />
            Más
          </button> : null}
        </div>
      </nav>
    </>
  );
}
