import { ClipboardCheck, ShieldCheck, Target, Trees } from "lucide-react";

import AppHeader from "../components/AppHeader.jsx";
import Sidebar from "../components/Sidebar.jsx";

const SUP_CLASSES = [
  { label: "S < 1 ha", desc: "Classe 1" },
  { label: "1 ≤ S < 2 ha", desc: "Classe 2" },
  { label: "2 ≤ S < 3 ha", desc: "Classe 3" },
  { label: "3 ≤ S < 5 ha", desc: "Classe 4" },
  { label: "5 ≤ S < 10 ha", desc: "Classe 5" },
  { label: "10 ≤ S < 20 ha", desc: "Classe 6" },
  { label: "20 ≤ S ≤ 30 ha", desc: "Classe 7" },
  { label: "S > 30 ha", desc: "Classe 8" },
];

export default function AuditSuperficiePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 lg:px-6">
        <Sidebar />

        <main className="flex-1 space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <ClipboardCheck size={22} />
                </div>
                <div>
                  <p className="text-sm font-medium text-violet-700">Audit de superficie</p>
                  <h1 className="text-2xl font-bold text-gray-900">Superficie à Audité</h1>
                </div>
              </div>

              <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700">
                Échantillonnage par classe
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-forest-100 text-forest-700">
                <Trees size={18} />
              </div>
              <p className="text-sm text-gray-500">Classes de superficie</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">8</p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Target size={18} />
              </div>
              <p className="text-sm text-gray-500">Surface minimale à auditer</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">20%</p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <ShieldCheck size={18} />
              </div>
              <p className="text-sm text-gray-500">Contrôle</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">Oui</p>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Règles de l’audit</h2>
            <ul className="space-y-3 text-sm text-gray-600">
              <li>• Toutes les classes doivent être auditées.</li>
              <li>• Toutes les brigades de chaque classe doivent être couvertes.</li>
              <li>• Au moins une fiche de chaque brigade doit être inspectée.</li>
              <li>• La superficie totale auditée doit être supérieure ou égale à 20% de la superficie générale.</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Classes disponibles</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {SUP_CLASSES.map((item, index) => (
                <div key={item.label} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{item.desc}</p>
                  <p className="mt-2 text-sm font-semibold text-gray-800">{item.label}</p>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
