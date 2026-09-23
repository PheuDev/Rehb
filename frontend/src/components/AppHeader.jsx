import { Menu, Plus, TreeDeciduous, X } from "lucide-react";

/**
 * Header partagé entre toutes les pages.
 * - sidebarOpen / onToggleSidebar : gestion du bouton hamburger (optionnel)
 * - onNewFiche : callback pour le bouton "Nouvelle fiche" (optionnel, masqué si absent)
 */
export default function AppHeader({ sidebarOpen, onToggleSidebar, onNewFiche }) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-100"
              title={sidebarOpen ? "Replier le menu" : "Ouvrir le menu"}
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          )}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-600 text-white">
            <TreeDeciduous size={22} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Gestion des réhabilitations forestières</h1>
            <p className="text-sm text-gray-500">Suivi des fiches PDA et des opérations sylvicoles</p>
          </div>
        </div>

        {onNewFiche && (
          <button onClick={onNewFiche} className="btn-primary">
            <Plus size={16} /> Nouvelle fiche
          </button>
        )}
      </div>
    </header>
  );
}
