import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, RefreshCw, Users } from "lucide-react";
import AppHeader from "../components/AppHeader.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { EmptyState, Spinner } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  getTeam,
  listBinomes,
  listEchantillonPlantations,
  listTeamBrigades,
  listTeamMembers,
  updateInspectionStatus,
} from "../api/terrain.js";
import { useSidebarState } from "../hooks/useSidebarState.js";

const ROLE_LABELS = { chef_equipe: "Chef d’équipe", binome: "Binôme" };

export default function MonEquipePage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useSidebarState();
  const [team, setTeam] = useState(null);
  const [brigades, setBrigades] = useState([]);
  const [binomes, setBinomes] = useState([]);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);

  async function loadTeam() {
    if (!user?.team_id) {
      setTeam(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [teamData, brigadeData, binomeData, memberData, taskData] = await Promise.all([
        getTeam(user.team_id),
        listTeamBrigades(user.team_id),
        listBinomes(user.team_id),
        listTeamMembers(user.team_id),
        listEchantillonPlantations({ include_replaced: true }),
      ]);
      setTeam(teamData);
      setBrigades(brigadeData);
      setBinomes(binomeData);
      setMembers(memberData);
      setTasks(taskData);
    } catch (err) {
      setError(err?.response?.data?.detail || "Impossible de charger les informations de votre équipe.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTeam(); }, [user?.team_id]);

  const completedCount = useMemo(() => tasks.filter((task) => task.inspection_completed).length, [tasks]);
  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  async function toggleTask(task) {
    const completed = !task.inspection_completed;
    setSavingId(task.id);
    setError("");
    try {
      const updated = await updateInspectionStatus(task.id, completed);
      setTasks((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (err) {
      setError(err?.response?.data?.detail || "Le statut de cette fiche n’a pas pu être mis à jour.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <AppHeader sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((open) => !open)} />
      <div className="mx-auto flex max-w-7xl items-start gap-6 px-4 py-6 sm:px-6">
        {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}
        <main className="min-w-0 flex-1 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Mon équipe</h2>
              <p className="mt-1 text-sm text-gray-500">Suivez la mission et indiquez les inspections terminées.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={loadTeam} disabled={loading}>
              <RefreshCw size={15} /> Actualiser
            </button>
          </div>

          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {loading ? <Spinner /> : !user?.team_id ? (
            <EmptyState message="Votre compte n’est pas encore rattaché à une équipe." />
          ) : team && (
            <>
              <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-forest-100 text-forest-700"><Users size={21} /></span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
                      <p className="text-sm text-gray-500">{members.length} membre{members.length === 1 ? "" : "s"} · {brigades.length} brigade{brigades.length === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  <div className="mt-5 border-t border-gray-100 pt-4">
                    <h4 className="text-sm font-semibold text-gray-800">Membres de l’équipe</h4>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {members.map((member) => (
                        <li key={member.id} className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-700">
                          {member.full_name || member.username}
                          <span className="ml-2 text-xs text-gray-500">{ROLE_LABELS[member.role] || member.role}</span>
                        </li>
                      ))}
                    </ul>
                    {binomes.length > 0 && <p className="mt-3 text-xs text-gray-500">{binomes.length} binôme{binomes.length === 1 ? "" : "s"} constitué{binomes.length === 1 ? "" : "s"}</p>}
                  </div>
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <h4 className="text-sm font-semibold text-gray-800">Brigades confiées</h4>
                    <p className="mt-2 text-sm text-gray-600">{brigades.length ? brigades.map((brigade) => brigade.brigade_name).join(", ") : "Aucune brigade affectée."}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Progression de la mission</p>
                      <p className="mt-1 text-3xl font-bold text-forest-700">{progress}%</p>
                    </div>
                    <CheckCircle2 className="text-forest-600" size={30} />
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progression des inspections de l’équipe">
                    <div className="h-full rounded-full bg-forest-600 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-3 text-sm text-gray-600">{completedCount} inspection{completedCount === 1 ? "" : "s"} terminée{completedCount === 1 ? "" : "s"} sur {tasks.length} fiche{tasks.length === 1 ? "" : "s"} échantillonnée{tasks.length === 1 ? "" : "s"}.</p>
                  <p className="mt-2 text-xs text-gray-500">La progression se met à jour quand un membre marque une fiche comme inspectée.</p>
                </div>
              </section>

              <section className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Tâches d’inspection</h3>
                  <p className="text-sm text-gray-500">Fiches échantillonnées de la dernière mission enregistrée pour vos brigades.</p>
                </div>
                {tasks.length === 0 ? <EmptyState message="Aucune fiche échantillonnée dans la mission active." /> : (
                  <ul className="space-y-2">
                    {tasks.map((task) => (
                      <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{task.pda_number || "Fiche sans numéro PDA"}</p>
                          <p className="mt-1 text-sm text-gray-500">{task.producer_name || "Producteur non renseigné"} · {task.brigade_name || "Brigade non renseignée"}</p>
                          {task.is_replaced && <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Remplacée</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleTask(task)}
                          disabled={savingId !== null}
                          aria-pressed={task.inspection_completed}
                          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${task.inspection_completed ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                        >
                          {task.inspection_completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                          {savingId === task.id ? "Enregistrement…" : task.inspection_completed ? "Inspection terminée" : "Marquer comme inspectée"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
