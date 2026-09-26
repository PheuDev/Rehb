import { useEffect, useState } from "react";
import { useSidebarState } from "../hooks/useSidebarState.js";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import { BarChart3, FileText, MapPin, TreeDeciduous, Users } from "lucide-react";

import AppHeader from "../components/AppHeader.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { Spinner } from "../components/ui.jsx";
import { getStats } from "../api/rehabilitations.js";
import { formatNumber } from "../utils/format.js";

// Enregistrement global Chart.js (une seule fois)
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend
);

// ─── Palette cohérente avec le design system ───────────────────────────────
const FOREST_600 = "#2d6846";
const FOREST_400 = "#5ba177";
const FOREST_200 = "#b9d9c4";
const FOREST_100 = "#dcece0";
const EMERALD   = "#059669";
const EMERALD_L = "#6ee7b7";
const AMBER     = "#d97706";
const SKY       = "#0284c7";

const SUP_CLASS_COLORS = [FOREST_600, FOREST_400, EMERALD, AMBER];

const CHART_FONT = {
  family: "Inter, ui-sans-serif, system-ui, sans-serif",
  size: 12,
};

const BASE_TOOLTIP = {
  backgroundColor: "#1f2937",
  titleColor: "#f9fafb",
  bodyColor: "#d1fae5",
  padding: 10,
  cornerRadius: 8,
};

// ─── Options communes ───────────────────────────────────────────────────────
function baseOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { font: CHART_FONT, color: "#374151" } },
      tooltip: { ...BASE_TOOLTIP, ...extra.tooltip },
      ...extra.plugins,
    },
    scales: extra.scales,
  };
}

// ─── KPI card ───────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, accent, loading }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex items-center gap-4">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accent}`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 truncate">{label}</p>
        {loading
          ? <Spinner size={18} />
          : <p className="text-2xl font-bold text-gray-900 leading-tight">{value ?? "—"}</p>
        }
      </div>
    </div>
  );
}

// ─── Carte chart wrapper ─────────────────────────────────────────────────────
function ChartCard({ title, children, className = "" }) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      <p className="mb-4 text-sm font-semibold text-gray-700">{title}</p>
      {children}
    </div>
  );
}

// ─── Bar chart — par département ─────────────────────────────────────────────
function BarDepartement({ data }) {
  const labels = data.map((d) => d.departement ?? "—");
  const chartData = {
    labels,
    datasets: [
      {
        label: "Fiches",
        data: data.map((d) => d.fiches),
        backgroundColor: FOREST_600,
        borderRadius: 4,
        yAxisID: "yFiches",
      },
      {
        label: "Superficie (ha)",
        data: data.map((d) => d.superficie),
        backgroundColor: EMERALD_L,
        borderRadius: 4,
        yAxisID: "ySuperficie",
      },
    ],
  };

  const options = baseOptions({
    scales: {
      x: { ticks: { font: CHART_FONT, color: "#6b7280" }, grid: { display: false } },
      yFiches: {
        type: "linear",
        position: "left",
        ticks: { font: CHART_FONT, color: FOREST_600 },
        grid: { color: "#f3f4f6" },
        title: { display: true, text: "Fiches", color: FOREST_600, font: CHART_FONT },
      },
      ySuperficie: {
        type: "linear",
        position: "right",
        ticks: { font: CHART_FONT, color: EMERALD },
        grid: { drawOnChartArea: false },
        title: { display: true, text: "ha", color: EMERALD, font: CHART_FONT },
      },
    },
  });

  return (
    <div style={{ height: "288px" }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}

// ─── Line chart — par année ──────────────────────────────────────────────────
function LineAnnee({ data }) {
  // Filtrer les années nulles
  const sorted = [...data].filter((d) => d.annee != null).sort((a, b) => a.annee - b.annee);
  const labels = sorted.map((d) => String(d.annee));

  const chartData = {
    labels,
    datasets: [
      {
        label: "Fiches",
        data: sorted.map((d) => d.fiches),
        borderColor: FOREST_600,
        backgroundColor: FOREST_100 + "99",
        fill: true,
        tension: 0.3,
        pointBackgroundColor: FOREST_600,
        pointRadius: 4,
        yAxisID: "yFiches",
      },
      {
        label: "Superficie (ha)",
        data: sorted.map((d) => d.superficie),
        borderColor: EMERALD,
        backgroundColor: "#d1fae5" + "66",
        fill: true,
        tension: 0.3,
        pointBackgroundColor: EMERALD,
        pointRadius: 4,
        yAxisID: "ySuperficie",
      },
    ],
  };

  const options = baseOptions({
    scales: {
      x: { ticks: { font: CHART_FONT, color: "#6b7280" }, grid: { display: false } },
      yFiches: {
        type: "linear",
        position: "left",
        ticks: { font: CHART_FONT, color: FOREST_600 },
        grid: { color: "#f3f4f6" },
        title: { display: true, text: "Fiches", color: FOREST_600, font: CHART_FONT },
      },
      ySuperficie: {
        type: "linear",
        position: "right",
        ticks: { font: CHART_FONT, color: EMERALD },
        grid: { drawOnChartArea: false },
        title: { display: true, text: "ha", color: EMERALD, font: CHART_FONT },
      },
    },
  });

  return (
    <div style={{ height: "288px" }}>
      <Line data={chartData} options={options} />
    </div>
  );
}

// ─── Doughnut — par classe de superficie ─────────────────────────────────────
function DoughnutSupClass({ data }) {
  // Ordre fixe des classes
  const ORDER = [
    "S < 1 ha",
    "1 ≤ S < 2 ha",
    "2 ≤ S < 3 ha",
    "3 ≤ S < 5 ha",
    "5 ≤ S < 10 ha",
    "10 ≤ S < 20 ha",
    "20 ≤ S ≤ 30 ha",
    "S > 30 ha",
  ];
  const sorted = ORDER.map((cls) => data.find((d) => d.supClass === cls) ?? { supClass: cls, fiches: 0, superficie: 0 });

  const chartData = {
    labels: sorted.map((d) => d.supClass),
    datasets: [
      {
        data: sorted.map((d) => d.fiches),
        backgroundColor: SUP_CLASS_COLORS,
        borderWidth: 2,
        borderColor: "#ffffff",
        hoverOffset: 8,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { font: CHART_FONT, color: "#374151", padding: 12 },
      },
      tooltip: {
        ...BASE_TOOLTIP,
        callbacks: {
          label: (ctx) => {
            const item = sorted[ctx.dataIndex];
            return ` ${ctx.label} : ${ctx.parsed} fiches — ${formatNumber(item.superficie)} ha`;
          },
        },
      },
    },
  };

  return (
    <div style={{ height: "256px" }}>
      <Doughnut data={chartData} options={options} />
    </div>
  );
}

// ─── Bar chart horizontal — top brigades ─────────────────────────────────────
function BarBrigades({ data }) {
  const top10 = [...data].sort((a, b) => b.fiches - a.fiches).slice(0, 10);

  const chartData = {
    labels: top10.map((d) => d.brigade),
    datasets: [
      {
        label: "Fiches",
        data: top10.map((d) => d.fiches),
        backgroundColor: top10.map((_, i) =>
          i === 0 ? FOREST_600 : i === 1 ? FOREST_400 : FOREST_200
        ),
        borderRadius: 4,
      },
    ],
  };

  const options = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...BASE_TOOLTIP,
        callbacks: {
          label: (ctx) => {
            const item = top10[ctx.dataIndex];
            return ` ${ctx.parsed.x} fiche(s) — ${formatNumber(item.superficie)} ha`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { font: CHART_FONT, color: "#6b7280" },
        grid: { color: "#f3f4f6" },
      },
      y: {
        ticks: {
          font: CHART_FONT,
          color: "#374151",
          // Tronque les noms longs
          callback: (val, i) => {
            const label = top10[i]?.brigade ?? "";
            return label.length > 22 ? label.slice(0, 20) + "…" : label;
          },
        },
        grid: { display: false },
      },
    },
  };

  return (
    <div style={{ height: "320px" }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useSidebarState();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getStats();
        setStats(data);
      } catch {
        // silencieux — l'UI reste vide
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <AppHeader
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      <div className="mx-auto flex max-w-7xl items-start gap-6 px-4 py-6 sm:px-6">
        {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}

        <main className="min-w-0 flex-1 space-y-6">
          {/* Titre */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-100 text-forest-700">
              <BarChart3 size={22} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
              <p className="text-sm text-gray-500">Vue d'ensemble des réhabilitations forestières</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-32">
              <Spinner size={36} />
            </div>
          ) : !stats ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-400 shadow-sm">
              Impossible de charger les statistiques.
            </div>
          ) : (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <div className="xl:col-span-2">
                  <KpiCard
                    icon={FileText}
                    label="Fiches enregistrées"
                    value={formatNumber(stats.totalFiches, 0)}
                    accent="bg-forest-100 text-forest-700"
                  />
                </div>
                <div className="xl:col-span-2">
                  <KpiCard
                    icon={TreeDeciduous}
                    label="Superficie réhabilitée (ha)"
                    value={formatNumber(stats.superficieTotale)}
                    accent="bg-emerald-100 text-emerald-700"
                  />
                </div>
                <div className="xl:col-span-1">
                  <KpiCard
                    icon={MapPin}
                    label="Départements"
                    value={formatNumber(stats.totalDepartements, 0)}
                    accent="bg-amber-100 text-amber-700"
                  />
                </div>
                <div className="xl:col-span-1">
                  <KpiCard
                    icon={Users}
                    label="Brigades"
                    value={formatNumber(stats.totalBrigades, 0)}
                    accent="bg-sky-100 text-sky-700"
                  />
                </div>
              </div>

              {/* Ligne 1 : Bar département (2/3) + Doughnut sup_class (1/3) */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <ChartCard
                  title="Fiches et superficie par département"
                  className="lg:col-span-2"
                >
                  {stats.parDepartement.length === 0 ? (
                    <p className="py-16 text-center text-sm text-gray-400">Aucune donnée</p>
                  ) : (
                    <BarDepartement data={stats.parDepartement} />
                  )}
                </ChartCard>

                <ChartCard title="Répartition par classe de superficie">
                  {stats.parSupClass.length === 0 ? (
                    <p className="py-16 text-center text-sm text-gray-400">Aucune donnée</p>
                  ) : (
                    <DoughnutSupClass data={stats.parSupClass} />
                  )}
                </ChartCard>
              </div>

              {/* Ligne 2 : Line annee (2/3) + Bar brigades (1/3) */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <ChartCard
                  title="Évolution annuelle des réhabilitations"
                  className="lg:col-span-2"
                >
                  {stats.parAnnee.filter((d) => d.annee != null).length === 0 ? (
                    <p className="py-16 text-center text-sm text-gray-400">Aucune donnée</p>
                  ) : (
                    <LineAnnee data={stats.parAnnee} />
                  )}
                </ChartCard>

                <ChartCard title="Top brigades (par nombre de fiches)">
                  {stats.parBrigade.length === 0 ? (
                    <p className="py-16 text-center text-sm text-gray-400">Aucune brigade enregistrée</p>
                  ) : (
                    <BarBrigades data={stats.parBrigade} />
                  )}
                </ChartCard>
              </div>

              {/* Récap textuel discret */}
              <p className="text-xs text-gray-400 text-right">
                {stats.totalCommunes} commune{stats.totalCommunes !== 1 ? "s" : ""} ·{" "}
                {stats.totalVillages} village{stats.totalVillages !== 1 ? "s" : ""} ·{" "}
                {stats.totalBrigades} brigade{stats.totalBrigades !== 1 ? "s" : ""}
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
