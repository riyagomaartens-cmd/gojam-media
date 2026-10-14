// ===========================================================
// Go Jam Studio OS — admin console
// ===========================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = "https://qkpnmoepnsmdkqgbfozz.supabase.co";
// anon public key — safe in client code, protected by row-level security
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrcG5tb2VwbnNtZGtxZ2Jmb3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5OTkwMzgsImV4cCI6MjEwNzU3NTAzOH0.HPHpzocgvcplluMMafy9V3Zv0PSPkaGtrR1-rVjCgxg";
const supa = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
const PSTATUS = [["enquiry", "Enquiry"], ["onboarding", "Onboarding"], ["in_production", "In production"], ["delivered", "Delivered"], ["follow_up", "Follow-up"], ["closed", "Closed"]];
const pLabel = (s) => (PSTATUS.find((x) => x[0] === s) || [s, s])[1];

// default onboarding -> delivery checklist, seeded on every new project
const STEP_TEMPLATE = [
  "Enquiry received",
  "Brief / treatment agreed",
  "Quote sent & accepted",
  "Deposit confirmed",
  "Shoot complete",
  "First edit sent",
  "Feedback & revisions",
  "Final delivery",
];

/* ---------- helpers ---------- */
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => esc(s).replace(/"/g, "&quot;");
const cap = (s) => { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); };
const val = (id) => { const e = $(id); return e ? e.value.trim() : ""; };
const setView = (html) => { $("view").innerHTML = html; window.scrollTo(0, 0); };
const setActiveNav = (name) => document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.nav === name));
const modal = (html) => { $("modal-root").innerHTML = `<div class="modal-bg" id="modal-bg"><div class="modal">${html}</div></div>`; $("modal-bg").onclick = (e) => { if (e.target.id === "modal-bg") closeModal(); }; };
const closeModal = () => { $("modal-root").innerHTML = ""; };
let toastT;
const toast = (msg) => { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2200); };

/* ---------- auth ---------- */
function showLogin() { $("login").classList.remove("hidden"); $("app").classList.add("hidden"); }
function showApp(session) {
  $("login").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("who").textContent = session.user.email;
  if (!location.hash || location.hash === "#") location.hash = "#/clients";
  else router();
}

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("login-err").textContent = "";
  $("login-btn").textContent = "Signing in...";
  const { error } = await supa.auth.signInWithPassword({ email: val("login-email"), password: $("login-pass").value });
  $("login-btn").textContent = "Sign in";
  if (error) $("login-err").textContent = error.message;
});
$("signout").onclick = () => supa.auth.signOut();

/* ---------- router ---------- */
function router() {
  const parts = (location.hash || "#/clients").slice(2).split("/");
  setActiveNav(parts[0] === "projects" ? "projects" : parts[0] || "clients");
  if (parts[0] === "clients" && parts[1]) return viewClient(parts[1]);
  if (parts[0] === "projects" && parts[1]) return viewProject(parts[1]);
  if (parts[0] === "projects") return viewProjects();
  if (parts[0] === "deliveries") return viewDeliveries();
  return viewClients();
}
window.addEventListener("hashchange", router);

/* ---------- clients ---------- */
let CLIENTS = [];
async function viewClients() {
  setView(`<div class="view-head"><h2>Clients</h2><div class="spacer"></div><button class="btn btn-primary" id="add-client">New client</button></div>
    <div class="toolbar">
      <input class="search" id="c-search" placeholder="Search clients..." />
      <select id="c-status"><option value="">All status</option><option value="lead">Lead</option><option value="active">Active</option><option value="past">Past</option></select>
    </div>
    <div id="c-list"><div class="empty">Loading...</div></div>`);
  $("add-client").onclick = () => clientForm();
  $("c-search").oninput = renderClientList;
  $("c-status").onchange = renderClientList;
  const { data, error } = await supa.from("clients").select("*").order("name");
  if (error) { $("c-list").innerHTML = `<div class="empty"><div class="big">Couldn't load</div><p>${esc(error.message)}</p></div>`; return; }
  CLIENTS = data || [];
  renderClientList();
}
function renderClientList() {
  if (!$("c-list")) return;
  const q = (val("c-search") || "").toLowerCase();
  const st = $("c-status") ? $("c-status").value : "";
  const rows = CLIENTS.filter((c) => (!st || c.status === st) && (!q || c.name.toLowerCase().includes(q) || (c.instagram || "").toLowerCase().includes(q)));
  const list = $("c-list");
  if (!rows.length) { list.innerHTML = `<div class="empty"><div class="big">${CLIENTS.length ? "No matches" : "No clients yet"}</div><p>${CLIENTS.length ? "Try another search." : "Add your first client to get started."}</p></div>`; return; }
  list.innerHTML = `<div class="grid">${rows.map(clientCard).join("")}</div>`;
  list.querySelectorAll("[data-client]").forEach((el) => (el.onclick = () => (location.hash = "#/clients/" + el.dataset.client)));
}
function clientCard(c) {
  const sub = [cap(c.type), c.instagram].filter(Boolean).map(esc).join(", ");
  return `<div class="card" data-client="${c.id}"><h3>${esc(c.name)}</h3><div class="sub">${sub}</div><div class="meta"><span class="badge ${esc(c.status)}">${cap(c.status)}</span></div></div>`;
}
function clientForm(client) {
  const c = client || {};
  modal(`<h3>${client ? "Edit client" : "New client"}</h3>
    <label class="fld"><span>Name</span><input id="f-name" value="${escAttr(c.name || "")}" /></label>
    <label class="fld"><span>Type</span><select id="f-type"><option value="artist">Artist</option><option value="brand">Brand</option><option value="other">Other</option></select></label>
    <label class="fld"><span>Status</span><select id="f-status"><option value="lead">Lead</option><option value="active">Active</option><option value="past">Past</option></select></label>
    <label class="fld"><span>Email</span><input id="f-email" value="${escAttr(c.email || "")}" /></label>
    <label class="fld"><span>Phone</span><input id="f-phone" value="${escAttr(c.phone || "")}" /></label>
    <label class="fld"><span>Instagram</span><input id="f-ig" value="${escAttr(c.instagram || "")}" placeholder="@handle" /></label>
    <label class="fld"><span>Notes</span><textarea id="f-notes" rows="3">${esc(c.notes || "")}</textarea></label>
    <div class="actions">${client ? `<button class="btn btn-danger btn-sm" id="f-del">Delete</button>` : ""}<div style="flex:1"></div><button class="btn btn-ghost" id="f-cancel">Cancel</button><button class="btn btn-primary" id="f-save">Save</button></div>`);
  $("f-type").value = c.type || "artist";
  $("f-status").value = c.status || "active";
  $("f-cancel").onclick = closeModal;
  $("f-save").onclick = async () => {
    const payload = { name: val("f-name"), type: $("f-type").value, status: $("f-status").value, email: val("f-email"), phone: val("f-phone"), instagram: val("f-ig"), notes: val("f-notes") };
    if (!payload.name) { toast("Name is required"); return; }
    let res;
    if (client) res = await supa.from("clients").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", client.id);
    else { const u = (await supa.auth.getUser()).data.user; res = await supa.from("clients").insert({ ...payload, created_by: u ? u.id : null }); }
    if (res.error) { toast(res.error.message); return; }
    closeModal(); toast("Saved");
    if (location.hash.startsWith("#/clients/") && client) viewClient(client.id);
    else viewClients();
  };
  if (client) $("f-del").onclick = async () => {
    if (!confirm("Delete this client and all their projects? This cannot be undone.")) return;
    const res = await supa.from("clients").delete().eq("id", client.id);
    if (res.error) { toast(res.error.message); return; }
    closeModal(); toast("Deleted"); location.hash = "#/clients";
  };
}

/* ---------- client detail ---------- */
async function viewClient(id) {
  setActiveNav("clients");
  setView(`<div class="empty">Loading...</div>`);
  const { data: c } = await supa.from("clients").select("*").eq("id", id).single();
  if (!c) { setView(`<div class="empty"><div class="big">Client not found</div><p><a href="#/clients">Back to clients</a></p></div>`); return; }
  const { data: projects } = await supa.from("projects").select("*").eq("client_id", id).order("created_at", { ascending: false });
  setView(`
    <div class="breadcrumb"><a href="#/clients">Clients</a> / ${esc(c.name)}</div>
    <div class="detail-top"><h2>${esc(c.name)}</h2><span class="badge ${esc(c.status)}">${cap(c.status)}</span><div style="flex:1"></div><button class="btn btn-ghost btn-sm" id="edit-client">Edit</button></div>
    <div class="info-rows">
      <div><div class="k">Type</div><div class="v">${cap(c.type)}</div></div>
      ${c.email ? `<div><div class="k">Email</div><div class="v"><a href="mailto:${escAttr(c.email)}">${esc(c.email)}</a></div></div>` : ""}
      ${c.phone ? `<div><div class="k">Phone</div><div class="v">${esc(c.phone)}</div></div>` : ""}
      ${c.instagram ? `<div><div class="k">Instagram</div><div class="v">${esc(c.instagram)}</div></div>` : ""}
    </div>
    ${c.notes ? `<div class="notes-box">${esc(c.notes)}</div>` : ""}
    <div class="view-head" style="margin-bottom:14px"><div class="section-title" style="margin:0">Projects</div><div style="flex:1"></div><button class="btn btn-primary btn-sm" id="add-project">New project</button></div>
    <div id="p-list"></div>`);
  $("edit-client").onclick = () => clientForm(c);
  $("add-project").onclick = () => projectForm({ client: c });
  renderProjects(projects || []);
}
function renderProjects(projects) {
  const list = $("p-list");
  if (!projects.length) { list.innerHTML = `<div class="empty" style="padding:30px 20px"><p>No projects yet. Add the first one.</p></div>`; return; }
  list.innerHTML = `<div class="rows">${projects.map(projectRow).join("")}</div>`;
  list.querySelectorAll("[data-pstatus]").forEach((sel) => (sel.onchange = async () => {
    const res = await supa.from("projects").update({ status: sel.value, updated_at: new Date().toISOString() }).eq("id", sel.dataset.pstatus);
    toast(res.error ? res.error.message : "Updated");
  }));
}
function projectRow(p) {
  return `<div class="row"><div class="title"><a class="plink" href="#/projects/${p.id}">${esc(p.title)}</a></div>${p.due_date ? `<span class="date">Due ${esc(p.due_date)}</span>` : ""}<div class="spacer"></div><select data-pstatus="${p.id}">${PSTATUS.map(([v, l]) => `<option value="${v}" ${p.status === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>`;
}
function projectForm({ client, project }) {
  const p = project || {};
  const name = client ? client.name : (p._clientName || "");
  modal(`<h3>${project ? "Edit project" : "New project"}</h3>
    ${name ? `<p style="color:var(--muted);font-size:0.82rem;margin:-8px 0 16px">for ${esc(name)}</p>` : ""}
    <label class="fld"><span>Title</span><input id="pf-title" value="${escAttr(p.title || "")}" placeholder="e.g. 16 Bars Music Video" /></label>
    <label class="fld"><span>Status</span><select id="pf-status">${PSTATUS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
    <label class="fld"><span>Due date</span><input type="date" id="pf-due" value="${escAttr(p.due_date || "")}" /></label>
    <label class="fld"><span>Notes</span><textarea id="pf-desc" rows="2">${esc(p.description || "")}</textarea></label>
    <div class="actions">${project ? `<button class="btn btn-danger btn-sm" id="pf-del">Delete</button>` : ""}<div style="flex:1"></div><button class="btn btn-ghost" id="pf-cancel">Cancel</button><button class="btn btn-primary" id="pf-save">${project ? "Save" : "Create"}</button></div>`);
  $("pf-status").value = p.status || "enquiry";
  $("pf-cancel").onclick = closeModal;
  $("pf-save").onclick = async () => {
    const title = val("pf-title"); if (!title) { toast("Title is required"); return; }
    const fields = { title, status: $("pf-status").value, due_date: val("pf-due") || null, description: val("pf-desc") };
    if (project) {
      const res = await supa.from("projects").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", project.id);
      if (res.error) { toast(res.error.message); return; }
      closeModal(); toast("Saved"); viewProject(project.id);
    } else {
      const ins = await supa.from("projects").insert({ client_id: client.id, ...fields }).select().single();
      if (ins.error) { toast(ins.error.message); return; }
      // seed the standard checklist on the new project
      await supa.from("project_steps").insert(STEP_TEMPLATE.map((label, i) => ({ project_id: ins.data.id, label, order_index: i })));
      closeModal(); toast("Project created"); location.hash = "#/projects/" + ins.data.id;
    }
  };
  if (project) $("pf-del").onclick = async () => {
    if (!confirm("Delete this project and its checklist? This cannot be undone.")) return;
    const res = await supa.from("projects").delete().eq("id", project.id);
    if (res.error) { toast(res.error.message); return; }
    closeModal(); toast("Deleted"); location.hash = project.client_id ? "#/clients/" + project.client_id : "#/projects";
  };
}

/* ---------- project detail + checklist ---------- */
async function viewProject(id) {
  setActiveNav("projects");
  setView(`<div class="empty">Loading...</div>`);
  const { data: p } = await supa.from("projects").select("*, clients(name)").eq("id", id).single();
  if (!p) { setView(`<div class="empty"><div class="big">Project not found</div><p><a href="#/projects">Back to projects</a></p></div>`); return; }
  const { data: stepsRaw } = await supa.from("project_steps").select("*").eq("project_id", id).order("order_index");
  const steps = stepsRaw || [];
  const cname = p.clients ? p.clients.name : "";
  const done = steps.filter((s) => s.done).length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  setView(`
    <div class="breadcrumb"><a href="#/projects">Projects</a> / ${p.client_id ? `<a href="#/clients/${p.client_id}">${esc(cname)}</a>` : esc(cname)} / ${esc(p.title)}</div>
    <div class="detail-top"><h2>${esc(p.title)}</h2><span class="badge ${esc(p.status)}">${esc(pLabel(p.status))}</span><div style="flex:1"></div><button class="btn btn-ghost btn-sm" id="edit-proj">Edit</button></div>
    <div class="info-rows">
      <div><div class="k">Client</div><div class="v">${p.client_id ? `<a href="#/clients/${p.client_id}">${esc(cname)}</a>` : esc(cname) || "Not set"}</div></div>
      <div><div class="k">Stage</div><div class="v"><select id="proj-stage" style="margin-top:2px">${PSTATUS.map(([v, l]) => `<option value="${v}" ${p.status === v ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>
      <div><div class="k">Due date</div><div class="v">${p.due_date ? esc(p.due_date) : "Not set"}</div></div>
    </div>
    ${p.description ? `<div class="notes-box">${esc(p.description)}</div>` : ""}
    <div class="section-title">Checklist</div>
    <div id="chk-wrap"></div>`);
  $("edit-proj").onclick = () => projectForm({ project: { ...p, _clientName: cname } });
  $("proj-stage").onchange = async (e) => {
    const res = await supa.from("projects").update({ status: e.target.value, updated_at: new Date().toISOString() }).eq("id", id);
    if (res.error) { toast(res.error.message); return; }
    toast("Stage updated"); viewProject(id);
  };
  renderChecklist(id, steps, done, pct);
}
function renderChecklist(id, steps, done, pct) {
  const wrap = $("chk-wrap");
  const list = steps.length
    ? `<div class="chk-progress"><div class="chk-bar"><span style="width:${pct}%"></span></div><div class="chk-count">${done} of ${steps.length} done</div></div>
       <div class="chk-list">${steps.map((s) => `<label class="chk" data-step="${s.id}"><input type="checkbox" ${s.done ? "checked" : ""} /><span class="chk-label ${s.done ? "done" : ""}">${esc(s.label)}</span><button class="chk-del" data-del="${s.id}" title="Remove step">&times;</button></label>`).join("")}</div>`
    : `<div class="empty" style="padding:24px 20px"><p>No steps yet.</p><button class="btn btn-primary btn-sm" id="apply-tpl" style="margin-top:12px">Add standard checklist</button></div>`;
  wrap.innerHTML = `${list}
    <div class="chk-add"><input id="step-new" placeholder="Add a step..." /><button class="btn btn-ghost btn-sm" id="step-add">Add</button></div>`;

  wrap.querySelectorAll(".chk input").forEach((box) => (box.onchange = async () => {
    const sid = box.closest("[data-step]").dataset.step;
    const res = await supa.from("project_steps").update({ done: box.checked, done_at: box.checked ? new Date().toISOString() : null }).eq("id", sid);
    if (res.error) { toast(res.error.message); return; }
    viewProject(id);
  }));
  wrap.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async (e) => {
    e.preventDefault();
    const res = await supa.from("project_steps").delete().eq("id", b.dataset.del);
    if (res.error) { toast(res.error.message); return; }
    toast("Step removed"); viewProject(id);
  }));
  const applyBtn = $("apply-tpl");
  if (applyBtn) applyBtn.onclick = async () => {
    const res = await supa.from("project_steps").insert(STEP_TEMPLATE.map((label, i) => ({ project_id: id, label, order_index: i })));
    if (res.error) { toast(res.error.message); return; }
    toast("Checklist added"); viewProject(id);
  };
  const addStep = async () => {
    const label = val("step-new"); if (!label) return;
    const res = await supa.from("project_steps").insert({ project_id: id, label, order_index: steps.length });
    if (res.error) { toast(res.error.message); return; }
    viewProject(id);
  };
  $("step-add").onclick = addStep;
  $("step-new").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); addStep(); } };
}

/* ---------- all projects: board + list ---------- */
let ALLPROJECTS = [];
let STEPCOUNTS = {};
let projView = "board";
async function viewProjects() {
  setView(`<div class="view-head"><h2>Projects</h2><div class="spacer"></div>
      <div class="seg" id="proj-seg"><button data-v="board" class="${projView === "board" ? "on" : ""}">Board</button><button data-v="list" class="${projView === "list" ? "on" : ""}">List</button></div>
    </div>
    <div class="toolbar" id="pa-toolbar"><select id="pa-status"><option value="">All status</option>${PSTATUS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></div>
    <div id="pa-list"><div class="empty">Loading...</div></div>`);
  $("proj-seg").querySelectorAll("button").forEach((b) => (b.onclick = () => { projView = b.dataset.v; viewProjects(); }));
  const { data, error } = await supa.from("projects").select("*, clients(name)").order("created_at", { ascending: false });
  if (error) { $("pa-list").innerHTML = `<div class="empty"><div class="big">Couldn't load</div><p>${esc(error.message)}</p></div>`; return; }
  ALLPROJECTS = data || [];
  const { data: sc } = await supa.from("project_steps").select("project_id, done");
  STEPCOUNTS = {};
  (sc || []).forEach((s) => { const e = STEPCOUNTS[s.project_id] || (STEPCOUNTS[s.project_id] = { done: 0, total: 0 }); e.total++; if (s.done) e.done++; });
  if ($("pa-status")) $("pa-status").onchange = renderProjectsView;
  renderProjectsView();
}
function stepBadge(pid) {
  const c = STEPCOUNTS[pid];
  return c ? ` <span class="pstep">${c.done}/${c.total}</span>` : "";
}
function renderProjectsView() {
  const tb = $("pa-toolbar"); if (tb) tb.style.display = projView === "list" ? "flex" : "none";
  const list = $("pa-list");
  if (!ALLPROJECTS.length) { list.innerHTML = `<div class="empty"><div class="big">No projects</div><p>Projects you add to clients appear here.</p></div>`; return; }
  if (projView === "board") {
    list.innerHTML = `<div class="board">${PSTATUS.map(([v, l]) => {
      const col = ALLPROJECTS.filter((p) => p.status === v);
      return `<div class="board-col"><h4>${esc(l)} <span class="n">${col.length}</span></h4>${col.map((p) => `<div class="board-card" data-pid="${p.id}"><div class="t">${esc(p.title)}${stepBadge(p.id)}</div><div class="c">${esc(p.clients ? p.clients.name : "")}</div></div>`).join("")}</div>`;
    }).join("")}</div>`;
    list.querySelectorAll("[data-pid]").forEach((el) => (el.onclick = () => (location.hash = "#/projects/" + el.dataset.pid)));
  } else {
    const st = $("pa-status") ? $("pa-status").value : "";
    const rows = ALLPROJECTS.filter((p) => !st || p.status === st);
    if (!rows.length) { list.innerHTML = `<div class="empty"><div class="big">No matches</div><p>Try another stage.</p></div>`; return; }
    list.innerHTML = `<div class="rows">${rows.map((p) => `<div class="row" data-pid="${p.id}"><div class="title">${esc(p.title)}${stepBadge(p.id)}</div><span class="date">${esc(p.clients ? p.clients.name : "")}</span><div class="spacer"></div><span class="badge ${esc(p.status)}">${esc(pLabel(p.status))}</span></div>`).join("")}</div>`;
    list.querySelectorAll(".row").forEach((r) => { r.style.cursor = "pointer"; r.onclick = () => (location.hash = "#/projects/" + r.dataset.pid); });
  }
}

/* ---------- deliveries (next phase) ---------- */
function viewDeliveries() {
  setView(`<div class="view-head"><h2>Deliveries</h2></div>
    <div class="empty"><div class="big">Coming next</div><p>Soon you'll create delivery links from each project and they'll be recorded here against the client. For now, the standalone builder is at <a href="/deliver-new.html" target="_blank" rel="noopener">/deliver-new.html</a>.</p></div>`);
}

/* ---------- boot ---------- */
(async function init() {
  const { data: { session } } = await supa.auth.getSession();
  if (session) showApp(session); else showLogin();
  supa.auth.onAuthStateChange((_event, s) => { if (s) showApp(s); else showLogin(); });
})();
