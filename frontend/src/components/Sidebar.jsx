import { useEffect } from "react";
import { NavLink } from "react-router-dom";
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
  Trees,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

// ─── Définition des sections de navigation ────────────────────────────────────
// roles: tableau des rôles autorisés. Absent = visible par tous.
const NAV_SECTIONS = [
  {
    label: null,
    items: [
      { path: "/",          icon: Home,      label: "Accueil",   accent: "bg-forest-100 text-forest-700", roles: ["admin"] },
      { path: "/dashboard", icon: BarChart3, label: "Dashboard", accent: "bg-sky-100 text-sky-700", roles: ["admin"] },
    ],
  },
  {
    label: "Terrain",
    items: [
      { path: "/terrain",    icon: Shovel,      label: "Mes plantations", accent: "bg-lime-100 text-lime-700", roles: ["admin", "chef_equipe", "binome"] },
      { path: "/mes-brigades", icon: Users,     label: "Mes brigades", accent: "bg-teal-100 text-teal-700", roles: ["chef_equipe", "binome"] },
      { path: "/plantations-hors-echantillon", icon: Trees, label: "Plantations hors échantillon", accent: "bg-amber-100 text-amber-700", roles: ["admin", "chef_equipe", "binome"] },
      { path: "/mon-equipe", icon: Users,       label: "Mon équipe", accent: "bg-sky-100 text-sky-700", roles: ["chef_equipe", "binome"] },
    ],
  },
  {
    label: "Répertoires",
    items: [
      { path: "/brigades",     icon: Users,  label: "Brigades",      accent: "bg-forest-100 text-forest-700", roles: ["admin"] },
      { path: "/producteurs",  icon: Leaf,   label: "Producteurs",   accent: "bg-emerald-100 text-emerald-700", roles: ["admin"] },
      { path: "/departements", icon: MapPin, label: "Départements",  accent: "bg-amber-100 text-amber-700", roles: ["admin"] },
    ],
  },
  {
    label: "Outils",
    items: [
      { path: "/audit",         icon: ClipboardCheck, label: "Superficie à Auditer", accent: "bg-violet-100 text-violet-700", roles: ["admin"] },
      { path: "/fiches-audit",  icon: FileText,       label: "Fiches d'audit",       accent: "bg-violet-100 text-violet-700", roles: ["admin"] },
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
function NavItem({ path, icon: Icon, label, accent, onNavigate }) {
  return (
    <NavLink
      to={path}
      onClick={onNavigate}
      className={({ isActive }) => `group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors duration-150 ${
        isActive
          ? "bg-forest-600 text-white shadow-sm"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white/40" />
          )}
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
              isActive ? "bg-white/20 text-white" : accent
            }`}
          >
            <Icon size={15} />
          </span>
          <span className="min-w-0 flex-1 truncate">{label}</span>
        </>
      )}
    </NavLink>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function Sidebar({ onClose }) {
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

  useEffect(() => {
    if (!window.matchMedia("(max-width: 1023px)").matches) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  const closeAfterNavigation = () => {
    if (window.matchMedia("(max-width: 1023px)").matches) onClose?.();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Fermer le menu"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-gray-950/40 lg:hidden"
      />
    <aside
      aria-label="Navigation principale"
      className="fixed inset-y-0 left-0 z-50 flex h-screen w-[min(18rem,calc(100vw-2rem))] shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white shadow-xl lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:max-h-[calc(100vh-3rem)] lg:w-64 lg:self-start lg:rounded-2xl lg:border lg:shadow-md"
    >

      {/* ── En-tête ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-600 text-white">
            <TreeDeciduous size={16} />
          </div>
          <span className="text-sm font-semibold text-gray-800 leading-tight">Menu</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Replier le menu"
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-500"
          title="Replier le menu"
        >
          <ChevronLeft size={17} />
        </button>
      </div>

      {/* ── Navigation ─────────────────────────────────────────── */}
      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
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
                  <NavItem {...item} onNavigate={closeAfterNavigation} />
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
    </>
  );
}
