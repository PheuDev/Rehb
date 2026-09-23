import { useNavigate, useLocation } from "react-router-dom";
import { BarChart3, ChevronLeft, Home, Menu, Users, Leaf } from "lucide-react";

function NavButton({ active, onClick, icon, label, right = null }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${
        active ? "bg-forest-600 text-white" : "text-gray-700 hover:bg-forest-50"
      }`}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {icon}
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </span>
      {right}
    </button>
  );
}

/**
 * Sidebar de navigation.
 * - Accueil → route /
 * - Liste des brigades → route /brigades (nouvelle page)
 * - Dashboard → placeholder "Bientôt"
 */
export default function Sidebar({ onClose }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <aside className="w-full shrink-0 self-start rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:w-72 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Menu size={16} className="text-forest-600" />
          <h2 className="text-sm font-semibold text-gray-900">Navigation</h2>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Replier la sidebar"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      <ul className="mt-3 space-y-1">
        <li>
          <NavButton
            active={pathname === "/"}
            onClick={() => navigate("/")}
            icon={<Home size={16} />}
            label="Accueil"
          />
        </li>
        <li>
          <NavButton
            active={pathname === "/dashboard"}
            onClick={() => navigate("/dashboard")}
            icon={<BarChart3 size={16} />}
            label="Dashboard"
          />
        </li>
        <li>
          <NavButton
            active={pathname === "/brigades"}
            onClick={() => navigate("/brigades")}
            icon={<Users size={16} />}
            label="Liste des brigades"
          />
        </li>
        <li>
          <NavButton
            active={pathname === "/producteurs"}
            onClick={() => navigate("/producteurs")}
            icon={<Leaf size={16} />}
            label="Liste des producteurs"
          />
        </li>
      </ul>
    </aside>
  );
}
