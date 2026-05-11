import { NavLink } from "react-router-dom";
import logo from "../../assets/logo-roca-eterna.svg";
import { navItems } from "./navigation";

export function Sidebar({ profile }) {
  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-72 flex-col bg-ink p-5 text-white lg:flex">
      <div className="flex items-center gap-3">
        <img src={logo} alt="Roca Eterna Música" className="h-12 w-12 rounded-2xl" />
        <div>
          <p className="text-sm font-bold">Roca Eterna</p>
          <p className="text-xs text-white/55">Música</p>
        </div>
      </div>

      <nav className="mt-10 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                isActive ? "bg-white text-ink" : "text-white/68 hover:bg-white/8 hover:text-white"
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto rounded-3xl border border-white/10 bg-white/7 p-4">
        <p className="text-xs text-white/45">Sesión</p>
        <p className="mt-1 truncate text-sm font-semibold">{profile?.displayName || profile?.email}</p>
        <p className="mt-2 inline-flex rounded-full bg-brass/20 px-2 py-1 text-xs font-semibold text-brass">
          {profile?.role || "viewer"}
        </p>
      </div>
    </aside>
  );
}
