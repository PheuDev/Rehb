import { Link, NavLink } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, List, NotebookTabs } from "lucide-react";
import AppHeader from "./AppHeader.jsx";

const links = [
  { to: "/ananas", label: "Plantations", Icon: List, end: true },
  { to: "/ananas/echantillonnage", label: "Échantillonnage", Icon: ClipboardCheck },
  { to: "/ananas/suggestions", label: "Suggestions enregistrées", Icon: NotebookTabs },
];

export default function AnanasLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Navigation Ananas" className="flex min-w-0 gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            {links.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${isActive ? "bg-amber-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <Icon size={16} /> {label}
              </NavLink>
            ))}
          </nav>
          <Link to="/" className="inline-flex min-h-10 shrink-0 items-center gap-2 self-start rounded-lg px-3 text-sm font-medium text-gray-500 hover:bg-white hover:text-gray-800 sm:self-auto">
            <ArrowLeft size={15} /> Changer de système
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
