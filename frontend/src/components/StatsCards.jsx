import { FileText, TreeDeciduous, MapPin, Users } from "lucide-react";
import { formatNumber } from "../utils/format.js";
import { Spinner } from "./ui.jsx";

function Card({ icon: Icon, label, value, loading, accent }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">{label}</p>
          {loading ? <Spinner size={18} /> : <p className="text-xl font-semibold text-gray-900">{value}</p>}
        </div>
      </div>
    </div>
  );
}

export default function StatsCards({ stats, loading }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card
        icon={FileText}
        label="Fiches enregistrées"
        value={formatNumber(stats?.totalFiches, 0)}
        loading={loading}
        accent="bg-forest-100 text-forest-700"
      />
      <Card
        icon={TreeDeciduous}
        label="Superficie réhabilitée totale (ha)"
        value={formatNumber(stats?.superficieTotale)}
        loading={loading}
        accent="bg-emerald-100 text-emerald-700"
      />
      <Card
        icon={MapPin}
        label="Départements couverts"
        value={formatNumber(stats?.totalDepartements, 0)}
        loading={loading}
        accent="bg-amber-100 text-amber-700"
      />
      <Card
        icon={Users}
        label="Villages bénéficiaires"
        value={formatNumber(stats?.totalVillages, 0)}
        loading={loading}
        accent="bg-sky-100 text-sky-700"
      />
    </div>
  );
}
