import { ArrowRight, Sprout, TreeDeciduous } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const SYSTEMS = [
  {
    title: "Système pour Anacardier",
    description: "Accédez au suivi des plantations, des brigades et des opérations de réhabilitation.",
    to: "/anacardier",
    Icon: TreeDeciduous,
    iconStyle: "bg-forest-100 text-forest-700",
    borderStyle: "hover:border-forest-300",
    actionStyle: "bg-forest-700 hover:bg-forest-800",
  },
  {
    title: "Système pour Ananas",
    description: "Un espace dédié au suivi des activités liées à la culture de l’ananas.",
    to: "/ananas",
    Icon: Sprout,
    iconStyle: "bg-amber-100 text-amber-700",
    borderStyle: "hover:border-amber-300",
    actionStyle: "bg-amber-600 hover:bg-amber-700",
  },
];

export default function SystemSelectorPage() {
  const { user } = useAuth();

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-forest-50 via-white to-emerald-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center">
        <header className="mb-8 text-center sm:mb-12">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-700 text-white shadow-lg shadow-forest-900/15">
            <TreeDeciduous size={30} />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-forest-700">Rehab Pacofide</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Choisissez votre système
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-gray-600 sm:text-base">
            {user?.full_name ? `Bonjour ${user.full_name}, choisissez l’espace à ouvrir.` : "Choisissez l’espace de travail auquel vous souhaitez accéder."}
          </p>
        </header>

        <section aria-label="Systèmes disponibles" className="grid gap-5 sm:grid-cols-2 sm:gap-6">
          {SYSTEMS.map(({ title, description, to, Icon, iconStyle, borderStyle, actionStyle }) => (
            <Link
              key={to}
              to={to}
              className={`group flex min-h-64 flex-col rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-forest-200 sm:min-h-72 sm:p-8 ${borderStyle}`}
            >
              <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${iconStyle}`}>
                <Icon size={30} strokeWidth={1.8} />
              </span>
              <h2 className="mt-6 text-xl font-bold text-gray-900 sm:text-2xl">{title}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-gray-600 sm:text-base">{description}</p>
              <span className={`mt-6 inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition ${actionStyle}`}>
                Ouvrir le système <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </section>
      </div>
      <p className="mt-8 text-center text-xs text-gray-400">Gestion des systèmes agricoles</p>
    </main>
  );
}
