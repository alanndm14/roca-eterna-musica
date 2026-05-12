import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { HelpCircle, LogOut, MoreHorizontal, X } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { mobileExtraItems, mobilePrimaryItems } from "./navigation";
import { Button } from "../ui/Button";

export function BottomNav() {
  const location = useLocation();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const isMoreActive = mobileExtraItems.some((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));

  const openGuide = () => {
    window.dispatchEvent(new Event("roca-eterna-open-guide"));
    setOpen(false);
  };

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 bg-ink/35 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute bottom-20 left-3 right-3 rounded-3xl border border-ink/10 bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
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
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-semibold transition ${isActive ? "bg-ink text-white" : "bg-ink/5 text-ink"}`
                  }
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
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
      <nav className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 border-t border-ink/10 bg-white/94 px-2 pb-2 pt-1 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          {mobilePrimaryItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition ${
                  isActive ? "bg-ink text-white" : "text-ink/55"
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition ${isMoreActive || open ? "bg-ink text-white" : "text-ink/55"}`}
          >
            <MoreHorizontal className="h-5 w-5" />
            Más
          </button>
        </div>
      </nav>
    </>
  );
}
