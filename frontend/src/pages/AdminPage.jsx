/**
 * Page Administration — réservée aux admins.
 *
 * Onglets :
 *  1. Équipes & Binômes
 *  2. Affectations (brigade → équipe, sans campagne, brigades non affectées)
 *  3. Utilisateurs
 */
import { useEffect, useState } from "react";
import {
  Plus, Pencil, Trash2, Users, Link2, UserCog,
  ChevronDown, ChevronRight, Save, X,
} from "lucide-react";
import AppHeader from "../components/AppHeader.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { Modal, Spinner, EmptyState } from "../components/ui.jsx";
import {
  listTeams, createTeam, updateTeam, deleteTeam,
  listBinomes, createBinome, deleteBinome,
  listUnassignedBrigades, assignBrigadeToTeam, removeAssignment, listTeamBrigades,
  listUsers, createUser, updateUser, resetUserPassword,
} from "../api/terrain.js";

const TABS = [
  { id: "teams",       label: "Équipes & Binômes", icon: Users },
  { id: "assignments", label: "Affectations",       icon: Link2 },
  { id: "users",       label: "Utilisateurs",       icon: UserCog },
];

const ROLE_LABELS = { admin: "Admin", chef_equipe: "Chef d'équipe", binome: "Binôme" };

// ─── Hook utilitaire ──────────────────────────────────────────────────────────
function useApiList(fetchFn, deps = []) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function reload() {
    setLoading(true);
    try { setItems(await fetchFn()); }
    catch (e) { setError(e?.response?.data?.detail || "Erreur de chargement."); }
    finally { setLoading(false); }
  }

  useEffect(() => { reload(); }, deps); // eslint-disable-line
  return { items, loading, error, reload };
}

// ─── Section Équipes & Binômes ────────────────────────────────────────────────
function TeamsSection() {
  const { items: teams, loading, reload } = useApiList(() => listTeams());
  const [expanded, setExpanded] = useState({});
  const [binomesMap, setBinomesMap] = useState({});
  const [newTeamName, setNewTeamName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editTeam, setEditTeam] = useState(null);
  const [newBinomeName, setNewBinomeName] = useState({});

  async function toggleTeam(teamId) {
    const next = !expanded[teamId];
    setExpanded(p => ({ ...p, [teamId]: next }));
    if (next && !binomesMap[teamId]) {
      const b = await listBinomes(teamId);
      setBinomesMap(p => ({ ...p, [teamId]: b }));
    }
  }

  async function handleCreateTeam(e) {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setSaving(true);
    try {
      await createTeam({ name: newTeamName.trim() });
      setNewTeamName("");
      reload();
    } catch (err) { alert(err?.response?.data?.detail || "Erreur."); }
    finally { setSaving(false); }
  }

  async function handleSaveEditTeam() {
    if (!editTeam) return;
    setSaving(true);
    try {
      await updateTeam(editTeam.id, { name: editTeam.name });
      setEditTeam(null);
      reload();
    } catch (err) { alert(err?.response?.data?.detail || "Erreur."); }
    finally { setSaving(false); }
  }

  async function handleDeleteTeam(id) {
    if (!confirm("Supprimer cette équipe et tous ses binômes ?")) return;
    await deleteTeam(id);
    reload();
  }

  async function handleCreateBinome(teamId) {
    const name = newBinomeName[teamId]?.trim();
    if (!name) return;
    await createBinome(teamId, name);
    const refreshed = await listBinomes(teamId);
    setNewBinomeName(p => ({ ...p, [teamId]: "" }));
    setBinomesMap(p => ({ ...p, [teamId]: refreshed }));
  }

  async function handleDeleteBinome(teamId, binomeId) {
    if (!confirm("Supprimer ce binôme ?")) return;
    await deleteBinome(binomeId);
    const refreshed = await listBinomes(teamId);
    setBinomesMap(p => ({ ...p, [teamId]: refreshed }));
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="space-y-4">
      {/* Formulaire nouvelle équipe */}
      <form onSubmit={handleCreateTeam} className="flex gap-2 p-4 bg-gray-50 rounded-xl border">
        <input className="input flex-1" placeholder="Nom de l'équipe" value={newTeamName}
          onChange={e => setNewTeamName(e.target.value)} required />
        <button className="btn-primary" type="submit" disabled={saving}>
          <Plus size={15} /> Créer
        </button>
      </form>

      {teams.length === 0 && <EmptyState message="Aucune équipe créée." />}

      {teams.map(team => (
        <div key={team.id} className="rounded-xl border bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
            onClick={() => toggleTeam(team.id)}>
            <div className="flex items-center gap-2">
              {expanded[team.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              {editTeam?.id === team.id ? (
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  <input className="input py-1 text-sm w-48" value={editTeam.name}
                    onChange={e => setEditTeam(p => ({ ...p, name: e.target.value }))} />
                  <button className="btn-primary py-1 px-2 text-xs" onClick={handleSaveEditTeam} disabled={saving}>
                    <Save size={13} />
                  </button>
                  <button className="btn-secondary py-1 px-2 text-xs" onClick={() => setEditTeam(null)}>
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <span className="font-medium text-gray-800">{team.name}</span>
              )}
            </div>
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <span className="text-xs text-gray-400 mr-2">{team.nb_binomes} binôme(s)</span>
              <button className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded"
                onClick={() => setEditTeam({ id: team.id, name: team.name })}>
                <Pencil size={14} />
              </button>
              <button className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                onClick={() => handleDeleteTeam(team.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {expanded[team.id] && (
            <div className="px-6 py-3 space-y-2">
              {(binomesMap[team.id] || []).map(b => (
                <div key={b.id} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <span className="text-sm text-gray-700">{b.name}
                    <span className="ml-2 text-xs text-gray-400">{b.nb_members} membre(s)</span>
                  </span>
                  <button className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    onClick={() => handleDeleteBinome(team.id, b.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <input className="input flex-1 py-1 text-sm" placeholder="Nouveau binôme…"
                  value={newBinomeName[team.id] || ""}
                  onChange={e => setNewBinomeName(p => ({ ...p, [team.id]: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && handleCreateBinome(team.id)}
                />
                <button className="btn-primary py-1 px-3 text-sm" onClick={() => handleCreateBinome(team.id)}>
                  <Plus size={13} /> Ajouter
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Section Affectations ─────────────────────────────────────────────────────
function AssignmentsSection() {
  const { items: teams } = useApiList(() => listTeams());
  const [selectedTeam, setSelectedTeam] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [selectedBrigade, setSelectedBrigade] = useState("");
  const [loadingA, setLoadingA] = useState(false);
  const [saving, setSaving] = useState(false);

  // Charger les brigades non affectées à chaque fois qu'on change d'équipe
  async function loadData(teamId) {
    if (!teamId) { setAssignments([]); setUnassigned([]); return; }
    setLoadingA(true);
    try {
      const [a, u] = await Promise.all([
        listTeamBrigades(teamId),
        listUnassignedBrigades(),
      ]);
      setAssignments(a);
      setUnassigned(u);
      setSelectedBrigade("");
    } catch { setAssignments([]); setUnassigned([]); }
    finally { setLoadingA(false); }
  }

  useEffect(() => { loadData(selectedTeam); }, [selectedTeam]);

  async function handleAssign(e) {
    e.preventDefault();
    if (!selectedBrigade || !selectedTeam) return;
    setSaving(true);
    try {
      await assignBrigadeToTeam(parseInt(selectedBrigade), parseInt(selectedTeam));
      loadData(selectedTeam);
    } catch (err) { alert(err?.response?.data?.detail || "Erreur."); }
    finally { setSaving(false); }
  }

  async function handleRemove(brigadeId, assignmentId) {
    if (!confirm("Retirer cette affectation ?")) return;
    await removeAssignment(brigadeId, assignmentId);
    loadData(selectedTeam);
  }

  return (
    <div className="space-y-4">
      {/* Sélecteur d'équipe */}
      <div className="flex gap-2 items-center p-4 bg-gray-50 rounded-xl border">
        <label className="text-sm font-medium text-gray-700 shrink-0">Équipe :</label>
        <select className="input flex-1 max-w-xs" value={selectedTeam}
          onChange={e => setSelectedTeam(e.target.value)}>
          <option value="">— Choisir une équipe —</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {selectedTeam && (
        <>
          {/* Formulaire nouvelle affectation */}
          <form onSubmit={handleAssign} className="flex flex-wrap gap-2 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <div className="flex-1 min-w-[200px]">
              <select className="input w-full bg-white" value={selectedBrigade}
                onChange={e => setSelectedBrigade(e.target.value)} required>
                <option value="">
                  {unassigned.length === 0
                    ? "— Toutes les brigades sont déjà affectées —"
                    : "— Choisir une brigade non affectée —"}
                </option>
                {unassigned.map(b => (
                  <option key={b.id} value={b.id}>{b.name}{b.manager_name ? ` (${b.manager_name})` : ""}</option>
                ))}
              </select>
            </div>
            <button className="btn-primary" type="submit" disabled={saving || !selectedBrigade}>
              <Link2 size={15} /> Affecter
            </button>
          </form>

          {/* Liste des brigades affectées à cette équipe */}
          {loadingA ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : assignments.length === 0 ? (
            <EmptyState message="Aucune brigade affectée à cette équipe." />
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Brigade</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {assignments.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{a.brigade_name}</td>
                      <td className="px-4 py-3 flex justify-end">
                        <button className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          onClick={() => handleRemove(a.brigade_id, a.id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Section Utilisateurs ─────────────────────────────────────────────────────
function UsersSection() {
  const { items: users, loading, reload } = useApiList(() => listUsers());
  const { items: teams } = useApiList(() => listTeams());
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ username: "", full_name: "", password: "", role: "binome", team_id: "", binome_id: "" });
  const [binomes, setBinomes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (form.team_id) listBinomes(form.team_id).then(setBinomes).catch(() => setBinomes([]));
    else setBinomes([]);
  }, [form.team_id]);

  function openCreate() {
    setEditUser(null);
    setForm({ username: "", full_name: "", password: "", role: "binome", team_id: "", binome_id: "" });
    setShowModal(true);
  }

  function openEdit(u) {
    setEditUser(u);
    setForm({ username: u.username, full_name: u.full_name || "", password: "", role: u.role, team_id: u.team_id || "", binome_id: u.binome_id || "" });
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, team_id: form.team_id || null, binome_id: form.binome_id || null };
      if (editUser) {
        const { username, password, ...upd } = payload;
        await updateUser(editUser.id, upd);
      } else {
        await createUser(payload);
      }
      setShowModal(false);
      reload();
    } catch (err) { alert(err?.response?.data?.detail || "Erreur."); }
    finally { setSaving(false); }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (!resetTarget || !newPassword) return;
    setSaving(true);
    try {
      await resetUserPassword(resetTarget.id, newPassword);
      setResetTarget(null);
      setNewPassword("");
    } catch (err) { alert(err?.response?.data?.detail || "Erreur."); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={openCreate}><Plus size={15} /> Nouvel utilisateur</button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Utilisateur</th>
              <th className="px-4 py-3 text-left">Nom complet</th>
              <th className="px-4 py-3 text-left">Rôle</th>
              <th className="px-4 py-3 text-left">Équipe</th>
              <th className="px-4 py-3 text-left">Actif</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-gray-800">{u.username}</td>
                <td className="px-4 py-3 text-gray-600">{u.full_name || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    u.role === "admin" ? "bg-purple-100 text-purple-700" :
                    u.role === "chef_equipe" ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-700"}`}>
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{u.team_name || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block h-2 w-2 rounded-full ${u.is_active ? "bg-green-500" : "bg-red-400"}`} />
                </td>
                <td className="px-4 py-3 flex justify-end gap-1">
                  <button className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded"
                    title="Modifier" onClick={() => openEdit(u)}>
                    <Pencil size={14} />
                  </button>
                  <button className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="Réinitialiser le mot de passe" onClick={() => { setResetTarget(u); setNewPassword(""); }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal créer/modifier utilisateur */}
      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={editUser ? "Modifier l'utilisateur" : "Nouvel utilisateur"} size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>Annuler</button>
            <button className="btn-primary" form="user-form" type="submit" disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </>
        }>
        <form id="user-form" onSubmit={handleSave} className="space-y-3">
          {!editUser && (
            <div>
              <label className="label">Nom d'utilisateur *</label>
              <input className="input" required value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
            </div>
          )}
          <div>
            <label className="label">Nom complet</label>
            <input className="input" value={form.full_name}
              onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
          </div>
          {!editUser && (
            <div>
              <label className="label">Mot de passe *</label>
              <input className="input" type="password" required minLength={6} value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
            </div>
          )}
          <div>
            <label className="label">Rôle *</label>
            <select className="input bg-white" value={form.role}
              onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
              <option value="admin">Admin</option>
              <option value="chef_equipe">Chef d'équipe</option>
              <option value="binome">Binôme</option>
            </select>
          </div>
          <div>
            <label className="label">Équipe</label>
            <select className="input bg-white" value={form.team_id}
              onChange={e => setForm(p => ({ ...p, team_id: e.target.value, binome_id: "" }))}>
              <option value="">— Aucune —</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {form.team_id && binomes.length > 0 && (
            <div>
              <label className="label">Binôme</label>
              <select className="input bg-white" value={form.binome_id}
                onChange={e => setForm(p => ({ ...p, binome_id: e.target.value }))}>
                <option value="">— Aucun —</option>
                {binomes.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          {editUser && (
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="is_active" checked={form.is_active !== false}
                onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
              <label htmlFor="is_active" className="text-sm text-gray-700">Compte actif</label>
            </div>
          )}
        </form>
      </Modal>

      {/* Modal réinitialisation mot de passe */}
      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)}
        title={`Réinitialiser — ${resetTarget?.username}`} size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setResetTarget(null)} disabled={saving}>Annuler</button>
            <button className="btn-primary" form="reset-pwd-form" type="submit" disabled={saving || !newPassword}>
              {saving ? "Enregistrement…" : "Réinitialiser"}
            </button>
          </>
        }>
        <form id="reset-pwd-form" onSubmit={handleResetPassword} className="space-y-3">
          <p className="text-sm text-gray-600">
            Nouveau mot de passe pour <strong>{resetTarget?.username}</strong>.
          </p>
          <div>
            <label className="label">Nouveau mot de passe *</label>
            <input className="input" type="password" required minLength={6}
              value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function AdminPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("teams");

  const sections = {
    teams: <TeamsSection />,
    assignments: <AssignmentsSection />,
    users: <UsersSection />,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(v => !v)} />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6">
        {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}
        <main className="flex-1 min-w-0 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Administration</h2>
            <p className="text-sm text-gray-500 mt-1">Gestion des équipes, affectations et utilisateurs.</p>
          </div>

          {/* Onglets */}
          <div className="flex gap-1 border-b border-gray-200">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-forest-600 text-forest-700"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}>
                  <Icon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {sections[activeTab]}
        </main>
      </div>
    </div>
  );
}
