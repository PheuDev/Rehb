import { ArrowLeft, Settings } from "lucide-react";
import { Link } from "react-router-dom";

export default function AnanasDevelopmentPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 via-white to-orange-50 px-4 py-10">
      <section className="w-full max-w-lg rounded-3xl border border-amber-100 bg-white p-8 text-center shadow-lg shadow-amber-900/5 sm:p-12">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Settings size={52} strokeWidth={1.6} className="animate-spin" style={{ animationDuration: "8s" }} />
        </div>
        <p className="mt-7 text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Système pour Ananas</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">En développement</h1>
        <p className="mt-3 text-gray-600">
          Cet espace est en cours de préparation. Il sera disponible prochainement.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-amber-300 hover:bg-amber-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-100"
        >
          <ArrowLeft size={16} /> Retour au choix des systèmes
        </Link>
      </section>
    </main>
  );
}
