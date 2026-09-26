import { KeyRound, LogOut, Menu, Plus, TreeDeciduous, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import ChangePasswordModal from "./ChangePasswordModal.jsx";

const ROLE_LABELS = {
  admin: "Administrateur",
  chef_equipe: "Chef d'équipe",
  binome: "Binôme",
};

export default function AppHeader({ sidebarOpen, onToggleSidebar, onNewFiche }) {
  const { user, logoutFn } = useAuth();
  const [showChangePwd, setShowChangePwd] = useState(false);
  const isFieldUser = user?.role !== "admin";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:px-6 sm:py-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                aria-label={sidebarOpen ? "Replier le menu" : "Ouvrir le menu"}
                aria-expanded={!!sidebarOpen}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                title={sidebarOpen ? "Replier le menu" : "Ouvrir le menu"}
              >
                {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            )}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-600 text-white sm:h-10 sm:w-10">
              <TreeDeciduous size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-gray-900 sm:text-lg">
                <span className="sm:hidden">{isFieldUser ? "Suivi terrain" : "Gestion forestière"}</span>
                <span className="hidden sm:inline">Gestion des réhabilitations forestières</span>
              </h1>
              <p className="hidden text-sm text-gray-500 sm:block">Suivi des fiches PDA et des opérations sylvicoles</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            {onNewFiche && (
              <button onClick={onNewFiche} className="btn-primary h-10 px-3 sm:px-4">
                <Plus size={16} /><span className="hidden sm:inline">Nouvelle fiche</span>
              </button>
            )}

            {user && (
              <div className="flex items-center gap-2">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-gray-800 leading-tight">
                    {user.full_name || user.username}
                  </p>
                  <p className="text-xs text-gray-500 leading-tight">
                    {ROLE_LABELS[user.role] || user.role}
                  </p>
                </div>
                <button
                  onClick={() => setShowChangePwd(true)}
                  aria-label="Changer mon mot de passe"
                  title="Changer mon mot de passe"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600"
                >
                  <KeyRound size={16} />
                </button>
                <button
                  onClick={logoutFn}
                  aria-label="Se déconnecter"
                  title="Se déconnecter"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <ChangePasswordModal open={showChangePwd} onClose={() => setShowChangePwd(false)} />
    </>
  );
}
