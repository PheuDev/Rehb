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

  return (
    <>
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

          <div className="flex items-center gap-3">
            {onNewFiche && (
              <button onClick={onNewFiche} className="btn-primary">
                <Plus size={16} /> Nouvelle fiche
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
                  title="Changer mon mot de passe"
                  className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-colors"
                >
                  <KeyRound size={16} />
                </button>
                <button
                  onClick={logoutFn}
                  title="Se déconnecter"
                  className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
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
