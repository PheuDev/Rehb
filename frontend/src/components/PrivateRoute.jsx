/**
 * PrivateRoute — redirige vers /login si l'utilisateur n'est pas authentifié.
 *
 * Props :
 *  - roles (optionnel) : tableau de rôles autorisés, ex. ['admin', 'chef_equipe']
 *    Si absent, tout utilisateur authentifié peut accéder à la route.
 */
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Pendant la vérification du token stocké, ne pas rediriger prématurément
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500 text-sm">
        Chargement…
      </div>
    );
  }

  // Non authentifié → login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Rôle insuffisant → accueil
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
