import { NavLink } from "react-router-dom";
import { mobileNavItems } from "./navigation";

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-ink/10 bg-white/94 px-2 pb-2 pt-1 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
        {mobileNavItems.map((item) => (
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
      </div>
    </nav>
  );
}
