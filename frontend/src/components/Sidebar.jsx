import { useNavigate, useLocation } from "react-router-dom";
import {
  BarChart3,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  Home,
  Leaf,
  MapPin,
  Settings,
  Shovel,
  TreeDeciduous,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

// ─── Définition des sections de navigation ────────────────────────────────────
// roles: tableau des rôles autorisés. Absent = visible par tous.
const NAV_SECTIONS = [
  {
    label: null,
    items: [
      { path: "/",          icon: Home,      label: "Accueil",   accent: "bg-forest-100 text-forest-700" },
      { path: "/dashboard", icon: BarChart3, label: "Dashboard", accent: "bg-sky-100 text-sky-700" },
    ],
  },
  {
    label: "Terrain",
    items: [
      { path: "/terrain",    icon: Shovel,      label: "Mes plantations", accent: "bg-lime-100 text-lime-700",   roles: ["admin", "chef_equipe", "binome"] },
      { path: "/mes-fiches", icon: FileText,    label: "Mes fiches",      accent: "bg-teal-100 text-teal-700",   roles: ["admin", "chef_equipe", "binome"] },
    ],
  },
  {
    label: "Répertoires",
    items: [
      { path: "/brigades",     icon: Users,  label: "Brigades",      accent: "bg-forest-100 text-forest-700" },
      { path: "/producteurs",  icon: Leaf,   label: "Producteurs",   accent: "bg-emerald-100 text-emerald-700" },
      { path: "/departements", icon: MapPin, label: "Départements",  accent: "bg-amber-100 text-amber-700" },
    ],
  },
  {
    label: "Outils",
    items: [
      { path: "/audit",         icon: ClipboardCheck, label: "Superficie à Auditer", accent: "bg-violet-100 text-violet-700" },
      { path: "/fiches-audit",  icon: FileText,       label: "Fiches d'audit",       accent: "bg-violet-100 text-violet-700" },
    ],
  },
  {
    label: "Administration",
    items: [
      { path: "/admin", icon: Settings, label: "Administration", accent: "bg-rose-100 text-rose-700", roles: ["admin"] },
    ],
  },
];

// ─── Bouton de navigation ─────────────────────────────────────────────────────
function NavItem({ path, icon: Icon, label, accent, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-150 ${
        active
          ? "bg-forest-600 text-white shadow-sm"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white/40" />
      )}
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
          active ? "bg-white/20 text-white" : accent
        }`}
      >
        <Icon size={15} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function Sidebar({ onClose }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const userRole = user?.role;

  // Filtre les sections/items selon le rôle
  const visibleSections = NAV_SECTIONS
    .map(section => ({
      ...section,
      items: section.items.filter(item =>
        !item.roles || (userRole && item.roles.includes(userRole))
      ),
    }))
    .filter(section => section.items.length > 0);

  return (
    <aside className="w-full shrink-0 self-start overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md lg:w-64 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:flex lg:flex-col">

      {/* ── En-tête ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-600 text-white">
            <TreeDeciduous size={16} />
          </div>
          <span className="text-sm font-semibold text-gray-800 leading-tight">Menu</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          title="Replier le menu"
        >
          <ChevronLeft size={17} />
        </button>
      </div>

      {/* ── Navigation ─────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {visibleSections.map((section, si) => (
          <div key={si}>
            {section.label && (
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                {section.label}
              </p>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.path}>
                  <NavItem
                    {...item}
                    active={pathname === item.path}
                    onClick={() => navigate(item.path)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 px-4 py-3">
        <p className="text-[11px] text-gray-400 leading-snug">
          Gestion des réhabilitations forestières
        </p>
      </div>
    </aside>
  );
}
