// ===========================================================
// Go Jam Studio OS — admin console
// ===========================================================
import { supa } from "./supa-config.js";

const $ = (id) => document.getElementById(id);

// pipeline stages (order = board column order)
const PSTATUS = [
  ["enquiry", "Enquiry"],
  ["onboarding", "Onboarding"],
  ["planning", "Planning"],
  ["shooting", "Shooting"],
  ["editing", "Editing"],
  ["delivered", "Delivered"],
  ["follow_up", "Follow-up"],
  ["closed", "Closed"],
];
// legacy status -> current stage (so old rows never disappear before cleanup)
const LEGACY = { in_production: "editing" };
const normSt = (s) => LEGACY[s] || s;
const pLabel = (s) => (PSTATUS.find((x) => x[0] === normSt(s)) || [s, s])[1];

// each stage has its own colour, used for badges + card outlines
const STAGE_COLOR = {
  enquiry: "#6ea8d8",
  onboarding: "#f0b544",
  planning: "#a78bdf",
  shooting: "#e08a3c",
  editing: "#45b9b0",
  delivered: "#4ba36a",
  follow_up: "#e07a9a",
  closed: "#8c8c96",
};
const stColor = (s) => STAGE_COLOR[normSt(s)] || "#8c8c96";
const stageBadge = (s) => { const c = stColor(s); return `<span class="badge" style="color:${c};border-color:${c}66">${esc(pLabel(s))}</span>`; };

// default onboarding -> delivery checklist, seeded on every new project
const STEP_TEMPLATE = [
  "Enquiry received",
  "Brief / treatment agreed",
  "Quote sent & accepted",
  "Deposit confirmed",
  "Planning & shot list",
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
const setActiveNav = (name) => {
  document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.nav === name));
  const brand = document.querySelector(".brand"); if (brand) brand.classList.toggle("active", name === "priority");
};
const modal = (html) => { $("modal-root").innerHTML = `<div class="modal-bg" id="modal-bg"><div class="modal">${html}</div></div>`; $("modal-bg").onclick = (e) => { if (e.target.id === "modal-bg") closeModal(); }; };
const closeModal = () => { $("modal-root").innerHTML = ""; };
let toastT;
const toast = (msg) => { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2200); };

// clients attached to a project, from the join embed or the single FK
function projClients(p) {
  const pc = p.project_clients;
  if (pc && pc.length) return pc.map((x) => x.clients).filter(Boolean);
  if (p.clients) return [{ id: p.client_id, name: p.clients.name }];
  return [];
}
const clientNames = (p) => projClients(p).map((c) => c.name).join(", ");

// delivery-link helpers — must match deliver-new.html exactly so links open in the portal
function driveId(url) {
  if (!url) return "";
  url = url.trim();
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(url)) return url;
  return "";
}
function folderId(url) {
  if (!url) return "";
  const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : "";
}
function b64encode(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p) => String.fromCharCode("0x" + p)));
}
async function copyText(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { return false; } }

/* ---------- auth ---------- */
function showLogin() { $("login").classList.remove("hidden"); $("app").classList.add("hidden"); }
function showApp(session) {
  $("login").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("who").textContent = session.user.email;
  if (!location.hash || location.hash === "#") location.hash = "#/dashboard";
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
  const parts = (location.hash || "#/dashboard").slice(2).split("/");
  const top = parts[0] || "dashboard";
  setActiveNav(top);
  if (top === "clients" && parts[1]) return viewClient(parts[1]);
  if (top === "projects" && parts[1]) return viewProject(parts[1]);
  if (top === "projects") return viewProjects();
  if (top === "onboarding") return viewOnboarding();
  if (top === "deliveries") return viewDeliveries();
  if (top === "priority") return viewPriority();
  if (top === "clients") return viewClients();
  return viewDashboard();
}
window.addEventListener("hashchange", router);

/* ---------- dashboard ---------- */
async function viewDashboard() {
  setActiveNav("dashboard");
  setView(`<div class="view-head"><h2>Overview</h2></div><div id="dash"><div class="empty">Loading...</div></div>`);
  const [cR, pR, fR, dR] = await Promise.all([
    supa.from("clients").select("id,status"),
    supa.from("projects").select("id,status"),
    supa.from("follow_ups").select("*, clients(name)").eq("kind", "lead_nudge").eq("status", "pending"),
    supa.from("deliveries").select("*, clients(name)").order("created_at", { ascending: false }).limit(5),
  ]);
  const clients = cR.data || [], projects = pR.data || [], fups = fR.data || [], delivs = dR.data || [];
  const cCount = (s) => clients.filter((c) => c.status === s).length;
  const stageCount = (st) => projects.filter((p) => normSt(p.status) === st).length;
  const inProd = stageCount("planning") + stageCount("shooting") + stageCount("editing");
  const t = isoDate(today0());
  const dueList = fups.filter((f) => f.due_date && f.due_date <= t).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  const overdue = dueList.filter((f) => f.due_date < t).length;
  const dueToday = dueList.filter((f) => f.due_date === t).length;

  let h = '<div class="dash-cards">';
  h += dashCard("#/clients", cCount("active"), "Active clients");
  h += dashCard("#/onboarding", cCount("lead"), "Open enquiries", overdue ? overdue + " overdue" : (dueToday ? dueToday + " due today" : ""), overdue ? "bad" : (dueToday ? "warn" : ""));
  h += dashCard("#/projects", inProd, "In production");
  h += dashCard("#/projects", stageCount("delivered"), "Delivered");
  h += '</div>';

  h += '<div class="section-title">Pipeline</div><div class="dash-pipe">';
  PSTATUS.forEach(([v, l]) => { const c = STAGE_COLOR[v]; h += `<a class="dash-stage" href="#/projects" style="border-color:${c}55"><span class="ds-n" style="color:${c}">${stageCount(v)}</span><span class="ds-l">${esc(l)}</span></a>`; });
  h += '</div>';

  h += '<div class="section-title">Needs attention</div>';
  h += dueList.length
    ? `<div class="rows">${dueList.slice(0, 8).map((f) => { const od = f.due_date < t; return `<div class="row" style="border-left:3px solid ${od ? "var(--red)" : "var(--accent-1)"}"><div class="title">${esc(f.clients ? f.clients.name : "Enquiry")} <span class="pstep">${esc(f.label || "Follow-up")}</span></div><span class="date">${od ? "Overdue " : "Due "}${esc(f.due_date)}</span><div class="spacer"></div><a class="btn btn-ghost btn-sm" href="#/onboarding">Open</a></div>`; }).join("")}</div>`
    : `<div class="empty" style="padding:24px"><p>Nothing due. Every enquiry is followed up.</p></div>`;

  h += '<div class="section-title">Recent deliveries</div>';
  h += delivs.length
    ? `<div class="rows">${delivs.map((d) => { const when = String(d.delivered_at || d.created_at || "").slice(0, 10); return `<div class="row"><div class="title">${esc(d.title || "Delivery")}${d.clients ? ` <span class="dlv-sub" style="display:inline">${esc(d.clients.name)}</span>` : ""}</div><span class="date">${esc(when)}</span><div class="spacer"></div><a class="btn btn-ghost btn-sm" href="${escAttr(d.delivery_link)}" target="_blank" rel="noopener">Open</a></div>`; }).join("")}</div>`
    : `<div class="empty" style="padding:24px"><p>No deliveries yet.</p></div>`;

  $("dash").innerHTML = h;
}
function dashCard(href, n, label, badge, cls) {
  return `<a class="dash-card ${cls || ""}" href="${href}"><div class="dc-n">${n}</div><div class="dc-l">${esc(label)}</div>${badge ? `<div class="dc-b">${esc(badge)}</div>` : ""}</a>`;
}

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
  // projects where this client is attached (via join table), falling back to the single FK
  let projects = [];
  const pc = await supa.from("project_clients").select("projects(*)").eq("client_id", id);
  if (!pc.error && pc.data) projects = pc.data.map((r) => r.projects).filter(Boolean);
  else { const r = await supa.from("projects").select("*").eq("client_id", id); projects = r.data || []; }
  projects.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
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
  $("add-project").onclick = () => projectForm({ presetClientId: c.id });
  renderProjects(projects);
}
function renderProjects(projects) {
  const list = $("p-list");
  if (!projects.length) { list.innerHTML = `<div class="empty" style="padding:30px 20px"><p>No projects yet. Add the first one.</p></div>`; return; }
  list.innerHTML = `<div class="rows">${projects.map(projectRow).join("")}</div>`;
  list.querySelectorAll("[data-pstatus]").forEach((sel) => (sel.onchange = async () => {
    const res = await supa.from("projects").update({ status: sel.value, updated_at: new Date().toISOString() }).eq("id", sel.dataset.pstatus);
    if (res.error) { toast(res.error.message); return; }
    toast("Updated"); viewClient(location.hash.split("/")[2]);
  }));
}
function projectRow(p) {
  const c = stColor(p.status);
  return `<div class="row" style="border-color:${c}55;border-left:3px solid ${c}"><div class="title"><a class="plink" href="#/projects/${p.id}">${esc(p.title)}</a></div>${p.due_date ? `<span class="date">Due ${esc(p.due_date)}</span>` : ""}<div class="spacer"></div><select data-pstatus="${p.id}">${PSTATUS.map(([v, l]) => `<option value="${v}" ${normSt(p.status) === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>`;
}

/* ---------- project create / edit (with multi-client picker) ---------- */
async function projectForm({ project, presetClientId }) {
  // load client list (use cache if we have it)
  let clients = CLIENTS.length ? CLIENTS : ((await supa.from("clients").select("id,name,status").order("name")).data || []);
  // work out which clients are currently attached
  const selected = new Set();
  if (project) {
    const { data, error } = await supa.from("project_clients").select("client_id").eq("project_id", project.id);
    if (!error && data) data.forEach((r) => selected.add(r.client_id));
    if (!selected.size && project.client_id) selected.add(project.client_id);
  } else if (presetClientId) selected.add(presetClientId);

  modal(`<h3>${project ? "Edit project" : "New project"}</h3>
    <label class="fld"><span>Title</span><input id="pf-title" value="${escAttr(project ? project.title : "")}" placeholder="e.g. 16 Bars Music Video" /></label>
    <div class="fld"><span>Client(s)</span>
      <input id="cli-search" class="cli-search" placeholder="Filter clients..." />
      <div class="cli-pick" id="cli-pick"></div>
      <div class="cli-hint">Tick one or more. The top-most selected client is the main contact.</div>
    </div>
    <label class="fld"><span>Stage</span><select id="pf-status">${PSTATUS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
    <label class="fld"><span>Due date</span><input type="date" id="pf-due" value="${escAttr(project && project.due_date ? project.due_date : "")}" /></label>
    <label class="fld"><span>Notes</span><textarea id="pf-desc" rows="2">${esc(project ? project.description || "" : "")}</textarea></label>
    <div class="actions">${project ? `<button class="btn btn-danger btn-sm" id="pf-del">Delete</button>` : ""}<div style="flex:1"></div><button class="btn btn-ghost" id="pf-cancel">Cancel</button><button class="btn btn-primary" id="pf-save">${project ? "Save" : "Create"}</button></div>`);
  $("pf-status").value = project ? normSt(project.status) : "enquiry";

  const renderPick = () => {
    const term = (val("cli-search") || "").toLowerCase();
    const rows = clients.filter((c) => !term || c.name.toLowerCase().includes(term));
    $("cli-pick").innerHTML = rows.length
      ? rows.map((c) => `<label class="cli-opt"><input type="checkbox" value="${c.id}" ${selected.has(c.id) ? "checked" : ""} /><span>${esc(c.name)}</span></label>`).join("")
      : `<div class="cli-none">No matches</div>`;
    $("cli-pick").querySelectorAll("input").forEach((b) => (b.onchange = () => { b.checked ? selected.add(b.value) : selected.delete(b.value); }));
  };
  renderPick();
  $("cli-search").oninput = renderPick;
  $("pf-cancel").onclick = closeModal;

  $("pf-save").onclick = async () => {
    const title = val("pf-title"); if (!title) { toast("Title is required"); return; }
    const chosen = clients.filter((c) => selected.has(c.id)).map((c) => c.id);
    if (!chosen.length) { toast("Pick at least one client"); return; }
    const fields = { title, status: $("pf-status").value, due_date: val("pf-due") || null, description: val("pf-desc") };
    if (project) {
      const res = await supa.from("projects").update({ ...fields, client_id: chosen[0], updated_at: new Date().toISOString() }).eq("id", project.id);
      if (res.error) { toast(res.error.message); return; }
      await supa.from("project_clients").delete().eq("project_id", project.id);
      await supa.from("project_clients").insert(chosen.map((cid) => ({ project_id: project.id, client_id: cid })));
      closeModal(); toast("Saved"); viewProject(project.id);
    } else {
      const ins = await supa.from("projects").insert({ client_id: chosen[0], ...fields }).select().single();
      if (ins.error) { toast(ins.error.message); return; }
      await supa.from("project_clients").insert(chosen.map((cid) => ({ project_id: ins.data.id, client_id: cid })));
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
  let q = await supa.from("projects").select("*, project_clients(clients(id,name))").eq("id", id).single();
  if (q.error) q = await supa.from("projects").select("*, clients!client_id(name)").eq("id", id).single();
  const p = q.data;
  if (!p) { setView(`<div class="empty"><div class="big">Project not found</div><p><a href="#/projects">Back to projects</a></p></div>`); return; }
  const { data: stepsRaw } = await supa.from("project_steps").select("*").eq("project_id", id).order("order_index");
  const steps = stepsRaw || [];
  const cl = projClients(p);
  const clLinks = cl.length ? cl.map((c) => `<a href="#/clients/${c.id}">${esc(c.name)}</a>`).join(", ") : "Not set";
  const done = steps.filter((s) => s.done).length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  setView(`
    <div class="breadcrumb"><a href="#/projects">Projects</a> / ${esc(p.title)}</div>
    <div class="detail-top" style="border-left:4px solid ${stColor(p.status)};padding-left:14px"><h2>${esc(p.title)}</h2>${stageBadge(p.status)}<div style="flex:1"></div><button class="btn btn-ghost btn-sm" id="edit-proj">Edit</button></div>
    <div class="info-rows">
      <div><div class="k">Client${cl.length > 1 ? "s" : ""}</div><div class="v">${clLinks}</div></div>
      <div><div class="k">Stage</div><div class="v"><select id="proj-stage" style="margin-top:2px">${PSTATUS.map(([v, l]) => `<option value="${v}" ${normSt(p.status) === v ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>
      <div><div class="k">Due date</div><div class="v">${p.due_date ? esc(p.due_date) : "Not set"}</div></div>
    </div>
    ${p.description ? `<div class="notes-box">${esc(p.description)}</div>` : ""}
    <div class="section-title">Checklist</div>
    <div id="chk-wrap"></div>
    <div class="view-head" style="margin:34px 0 14px"><div class="section-title" style="margin:0">Deliveries</div><div style="flex:1"></div><button class="btn btn-primary btn-sm" id="add-delivery">New delivery</button></div>
    <div id="dlv-list"><div class="empty" style="padding:20px">Loading...</div></div>`);
  $("edit-proj").onclick = () => projectForm({ project: p });
  $("proj-stage").onchange = async (e) => {
    const res = await supa.from("projects").update({ status: e.target.value, updated_at: new Date().toISOString() }).eq("id", id);
    if (res.error) { toast(res.error.message); return; }
    toast("Stage updated"); viewProject(id);
  };
  const primaryId = p.client_id || (cl[0] && cl[0].id) || null;
  const primaryName = (cl[0] && cl[0].name) || "";
  $("add-delivery").onclick = () => deliveryForm({ projectId: id, clientId: primaryId, projectTitle: p.title, clientName: primaryName, onDone: () => loadDeliveries(id, primaryName) });
  renderChecklist(id, steps, done, pct);
  loadDeliveries(id, primaryName);
}

/* ---------- deliveries on a project ---------- */
async function loadDeliveries(projectId, clientName) {
  const box = $("dlv-list"); if (!box) return;
  const { data, error } = await supa.from("deliveries").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  if (error) { box.innerHTML = `<div class="empty" style="padding:20px"><p>${esc(error.message)}</p></div>`; return; }
  const rows = data || [];
  if (!rows.length) { box.innerHTML = `<div class="empty" style="padding:24px 20px"><p>No deliveries yet. Create a link to send your client.</p></div>`; return; }
  box.innerHTML = `<div class="rows">${rows.map((d) => deliveryRow(d, clientName)).join("")}</div>`;
  wireDeliveryButtons(box, () => loadDeliveries(projectId, clientName));
}
function deliveryRow(d, clientName) {
  const when = String(d.delivered_at || d.created_at || "").slice(0, 10);
  return `<div class="row"><div class="title">${esc(d.title || "Delivery")}</div><span class="date">${esc(when)}</span><div class="spacer"></div>${deliveryBtns(d, clientName)}</div>`;
}
function deliveryBtns(d, clientName) {
  return `<a class="btn btn-ghost btn-sm" href="${escAttr(d.delivery_link)}" target="_blank" rel="noopener">Open</a><button class="btn btn-primary btn-sm" data-copymsg data-link="${escAttr(d.delivery_link)}" data-title="${escAttr(d.title || "")}" data-client="${escAttr(clientName || "")}">Message</button><button class="btn btn-ghost btn-sm" data-copy="${escAttr(d.delivery_link)}">Link</button><button class="btn btn-danger btn-sm" data-deldlv="${d.id}">Delete</button>`;
}
function wireDeliveryButtons(box, reload) {
  box.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = async (e) => { e.preventDefault(); e.stopPropagation(); const ok = await copyText(b.dataset.copy); toast(ok ? "Link copied" : "Copy failed"); }));
  box.querySelectorAll("[data-copymsg]").forEach((b) => (b.onclick = async (e) => { e.preventDefault(); e.stopPropagation(); const ok = await copyText(deliveryMessage(b.dataset.client, b.dataset.title, b.dataset.link)); toast(ok ? "Message copied, ready to send" : "Copy failed"); }));
  box.querySelectorAll("[data-deldlv]").forEach((b) => (b.onclick = async (e) => {
    e.stopPropagation();
    if (!confirm("Delete this delivery record? The link stops being tracked here (it keeps working if already sent).")) return;
    const res = await supa.from("deliveries").delete().eq("id", b.dataset.deldlv);
    if (res.error) { toast(res.error.message); return; }
    toast("Deleted"); reload();
  }));
}
async function deliveryForm({ projectId, clientId, projectTitle, clientName, pickClient, onDone }) {
  let projs = [];
  if (pickClient) {
    if (!CLIENTS.length) CLIENTS = (await supa.from("clients").select("*").order("name")).data || [];
    projs = (await supa.from("projects").select("id,title,client_id").order("created_at", { ascending: false })).data || [];
  }
  const picker = pickClient ? `
    <label class="fld"><span>Client</span><input id="d-client" list="d-client-dl" value="${escAttr(clientName || "")}" placeholder="Select or type a new client" autocomplete="off" /><datalist id="d-client-dl">${CLIENTS.map((c) => `<option value="${escAttr(c.name)}"></option>`).join("")}</datalist><div class="cli-hint" style="margin-top:6px">Pick from your list, or type a new name to create the client.</div></label>
    <label class="fld"><span>Link to a project (optional)</span><select id="d-project"><option value="">None</option></select></label>` : "";
  modal(`<h3>New delivery</h3>
    <div class="bld-note-sm">In Google Drive, set the video and photos to "Anyone with the link, Viewer" first, or the client can't open them.</div>
    ${picker}
    <label class="fld"><span>Title</span><input id="d-title" value="${escAttr(projectTitle || "")}" placeholder="e.g. 16 Bars Official Music Video" /></label>
    <label class="fld"><span>Video link, or project folder link</span><input id="d-video" placeholder="Drive video file link, or a folder link" /></label>
    <div class="cli-hint" style="margin:-8px 0 14px">One video: paste the file link. Multiple videos or photos: paste a folder link and we pull them all out.</div>
    <label class="fld"><span>Delivery date</span><input type="date" id="d-date" /></label>
    <label class="fld"><span>Personal note (optional)</span><textarea id="d-note" rows="2" placeholder="Thanks for trusting us with this one..."></textarea></label>
    <div class="fld"><span>Vertical video</span><label class="tog2"><input type="checkbox" id="d-portrait" /> Portrait / reel (9:16)</label></div>
    <div class="fld"><span>Include on the delivery</span>
      <label class="tog2"><input type="checkbox" id="d-review" checked /> Google review button</label>
      <label class="tog2"><input type="checkbox" id="d-feedback" checked /> Feedback form button</label>
      <label class="tog2"><input type="checkbox" id="d-cta" checked /> Book next project button</label>
    </div>
    <label class="fld"><span>Passcode (optional)</span><input id="d-pass" placeholder="Leave blank for none" /></label>
    <div class="actions"><div style="flex:1"></div><button class="btn btn-ghost" id="d-cancel">Cancel</button><button class="btn btn-primary" id="d-save">Create link</button></div>`);
  $("d-date").value = new Date().toISOString().slice(0, 10);
  $("d-cancel").onclick = closeModal;
  if (pickClient) {
    const fillProjects = () => {
      const nm = val("d-client").toLowerCase();
      const cli = CLIENTS.find((c) => c.name.toLowerCase() === nm);
      const opts = cli ? projs.filter((p) => p.client_id === cli.id) : [];
      $("d-project").innerHTML = `<option value="">None</option>` + opts.map((p) => `<option value="${p.id}">${esc(p.title)}</option>`).join("");
    };
    $("d-client").oninput = fillProjects;
    $("d-project").onchange = () => { const p = projs.find((x) => x.id === $("d-project").value); if (p && !val("d-title")) $("d-title").value = p.title; };
    fillProjects();
  }
  $("d-save").onclick = async () => {
    let cId = clientId, pId = projectId, cName = clientName;
    if (pickClient) {
      cName = val("d-client"); if (!cName) { toast("Pick or type a client"); return; }
      const cli = CLIENTS.find((c) => c.name.toLowerCase() === cName.toLowerCase());
      if (cli) cId = cli.id;
      else {
        const u = (await supa.auth.getUser()).data.user;
        const ins = await supa.from("clients").insert({ name: cName, type: "artist", status: "active", created_by: u ? u.id : null }).select().single();
        if (ins.error) { toast(ins.error.message); return; }
        cId = ins.data.id; CLIENTS.push(ins.data);
      }
      pId = $("d-project").value || null;
    }
    const mainVal = val("d-video");
    const fol = folderId(mainVal);
    const vid = fol ? "" : driveId(mainVal);
    if (!fol && !vid) { toast("Paste a Drive video link or a folder link"); return; }
    const data = {};
    if (fol) data.folder = fol; else data.videoId = vid;
    if ($("d-portrait").checked) data.portrait = true;
    if (!$("d-review").checked) data.noReview = true;
    if (!$("d-feedback").checked) data.noFeedback = true;
    if (!$("d-cta").checked) data.noCta = true;
    if (cName) data.client = cName;
    const title = val("d-title"); if (title) data.title = title;
    const date = val("d-date"); if (date) data.date = date;
    const note = val("d-note"); if (note) data.note = note;
    const pass = val("d-pass"); if (pass) data.pass = pass;
    const link = location.origin + "/deliver.html#" + b64encode(JSON.stringify(data));
    const res = await supa.from("deliveries").insert({
      project_id: pId, client_id: cId, title: title || null,
      delivery_link: link, drive_folder_id: fol || null, drive_video_id: vid || null,
      portrait: !!data.portrait, delivered_at: date ? new Date(date).toISOString() : new Date().toISOString(),
    });
    if (res.error) { toast(res.error.message); return; }
    const copied = await copyText(deliveryMessage(cName, title, link));
    closeModal(); toast(copied ? "Delivery message copied, ready to send" : "Delivery created");
    if (onDone) onDone();
  };
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
      <button class="btn btn-primary btn-sm" id="add-project">New project</button>
      <div class="seg" id="proj-seg"><button data-v="board" class="${projView === "board" ? "on" : ""}">Board</button><button data-v="list" class="${projView === "list" ? "on" : ""}">List</button></div>
    </div>
    <div class="toolbar" id="pa-toolbar"><select id="pa-status"><option value="">All stages</option>${PSTATUS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></div>
    <div id="pa-list"><div class="empty">Loading...</div></div>`);
  $("add-project").onclick = () => projectForm({});
  $("proj-seg").querySelectorAll("button").forEach((b) => (b.onclick = () => { projView = b.dataset.v; viewProjects(); }));
  let q = await supa.from("projects").select("*, project_clients(clients(id,name))").order("created_at", { ascending: false });
  if (q.error) q = await supa.from("projects").select("*, clients!client_id(name)").order("created_at", { ascending: false });
  if (q.error) { $("pa-list").innerHTML = `<div class="empty"><div class="big">Couldn't load</div><p>${esc(q.error.message)}</p></div>`; return; }
  ALLPROJECTS = q.data || [];
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
  if (!ALLPROJECTS.length) { list.innerHTML = `<div class="empty"><div class="big">No projects</div><p>Add your first project with the button above.</p></div>`; return; }
  if (projView === "board") {
    list.innerHTML = `<div class="board">${PSTATUS.map(([v, l]) => {
      const col = ALLPROJECTS.filter((p) => normSt(p.status) === v);
      const c = STAGE_COLOR[v];
      return `<div class="board-col"><h4 style="color:${c}">${esc(l)} <span class="n">${col.length}</span></h4>${col.map((p) => `<div class="board-card" data-pid="${p.id}" style="border-color:${c}55;border-left:3px solid ${c}"><div class="t">${esc(p.title)}${stepBadge(p.id)}</div><div class="c">${esc(clientNames(p))}</div></div>`).join("")}</div>`;
    }).join("")}</div>`;
    list.querySelectorAll("[data-pid]").forEach((el) => (el.onclick = () => (location.hash = "#/projects/" + el.dataset.pid)));
  } else {
    const st = $("pa-status") ? $("pa-status").value : "";
    const rows = ALLPROJECTS.filter((p) => !st || normSt(p.status) === st);
    if (!rows.length) { list.innerHTML = `<div class="empty"><div class="big">No matches</div><p>Try another stage.</p></div>`; return; }
    list.innerHTML = `<div class="rows">${rows.map((p) => { const c = stColor(p.status); return `<div class="row" data-pid="${p.id}" style="border-color:${c}55;border-left:3px solid ${c}"><div class="title">${esc(p.title)}${stepBadge(p.id)}</div><span class="date">${esc(clientNames(p))}</span><div class="spacer"></div>${stageBadge(p.status)}</div>`; }).join("")}</div>`;
    list.querySelectorAll(".row").forEach((r) => { r.style.cursor = "pointer"; r.onclick = () => (location.hash = "#/projects/" + r.dataset.pid); });
  }
}

/* ---------- onboarding: enquiries + follow-ups ---------- */
const SOURCES = [["whatsapp", "WhatsApp"], ["instagram", "Instagram"], ["email", "Email"], ["referral", "Referral"], ["other", "Other"]];
const srcLabel = (s) => (SOURCES.find((x) => x[0] === s) || [s, s || "Other"])[1];
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const isoDate = (d) => { const p = (n) => (n < 10 ? "0" + n : "" + n); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); };
const SIGN_OFF = "\n\nKind regards,\nRiyago\nGo Jam Media 🎥";
function followupPlan(name) {
  const n = (name || "there").trim();
  return [
    { label: "Day 1", offset: 1, msg: "Hey " + n + "! 👋 Thanks so much for reaching out to Go Jam. 🙌 We're genuinely excited about what you've got in mind. When's a good time for a quick call to run through the vision and sort you a quote? We're always ready to go whenever you are. 🎬" + SIGN_OFF },
    { label: "Day 3", offset: 3, msg: "Hey " + n + "! 😊 Just circling back on your project. Still keen to help you bring this one to life. ✨ Happy to jump on a quick call or answer anything right here. Whenever you're ready, so are we. 🎥" + SIGN_OFF },
    { label: "Day 7", offset: 7, msg: "Hi " + n + "! 🙏 Checking in one more time. We've got some space opening up soon and would love to lock your project in. 📅 Let me know if you want to move forward and we'll get the ball rolling. 🚀" + SIGN_OFF },
    { label: "Day 14", offset: 14, msg: "Hey " + n + "! 💛 Last nudge from us, no pressure at all. If the timing isn't right just yet, we're always ready to go when it is. Reach out whenever and we'll pick it straight up. 🎬" + SIGN_OFF },
  ];
}
function deliveryMessage(clientName, title, link) {
  const who = (clientName || "").trim() || "there";
  const proj = title ? ' "' + title + '"' : "";
  return "Hey " + who + "! 🎬✨\n\nYour project" + proj + " is ready and we could not be happier with how it turned out! 🙌 Watch it, download it and grab everything right here:\n\n" + link + "\n\nThank you so much for trusting Go Jam with this one, it genuinely means the world to us. 💛 If you love what you see, a quick Google review helps other artists and brands find us. ⭐" + SIGN_OFF;
}

let LEADS = [], FUPS = {};
async function viewOnboarding() {
  setActiveNav("onboarding");
  setView(`<div class="view-head"><h2>Onboarding</h2><div class="spacer"></div><button class="btn btn-primary" id="new-enquiry">New enquiry</button></div>
    <div id="ob-summary"></div>
    <div id="ob-list"><div class="empty">Loading...</div></div>`);
  $("new-enquiry").onclick = () => enquiryForm();
  const { data: leads, error } = await supa.from("clients").select("*").eq("status", "lead").order("created_at", { ascending: false });
  if (error) { $("ob-list").innerHTML = `<div class="empty"><div class="big">Couldn't load</div><p>${esc(error.message)}</p></div>`; return; }
  LEADS = leads || [];
  FUPS = {};
  if (LEADS.length) {
    const { data: fups } = await supa.from("follow_ups").select("*").eq("kind", "lead_nudge").in("client_id", LEADS.map((l) => l.id));
    (fups || []).forEach((f) => (FUPS[f.client_id] || (FUPS[f.client_id] = [])).push(f));
    Object.values(FUPS).forEach((arr) => arr.sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))));
  }
  renderOnboarding();
}
function fupState(f) {
  if (f.status === "done") return "done";
  if (f.status === "dismissed") return "dismissed";
  if (!f.due_date) return "upcoming";
  const t = isoDate(today0());
  if (f.due_date < t) return "overdue";
  if (f.due_date === t) return "due";
  return "upcoming";
}
function renderOnboarding() {
  let due = 0, overdue = 0;
  Object.values(FUPS).forEach((arr) => arr.forEach((f) => { const s = fupState(f); if (s === "due") due++; else if (s === "overdue") overdue++; }));
  const sum = $("ob-summary");
  sum.innerHTML = LEADS.length
    ? `<div class="ob-stats"><div class="ob-stat"><span class="n">${LEADS.length}</span> open ${LEADS.length === 1 ? "enquiry" : "enquiries"}</div><div class="ob-stat ${overdue ? "bad" : ""}"><span class="n">${overdue}</span> overdue</div><div class="ob-stat ${due ? "warn" : ""}"><span class="n">${due}</span> due today</div></div>`
    : "";
  const list = $("ob-list");
  if (!LEADS.length) { list.innerHTML = `<div class="empty"><div class="big">No open enquiries</div><p>Log a new enquiry and we'll schedule the 1, 3, 7 and 14 day follow-ups automatically.</p></div>`; return; }
  list.innerHTML = LEADS.map(leadCard).join("");
  list.querySelectorAll("[data-fu]").forEach((el) => (el.onclick = () => followupModal(el.dataset.fu)));
  list.querySelectorAll("[data-convert]").forEach((b) => (b.onclick = () => convertLead(b.dataset.convert)));
  list.querySelectorAll("[data-lost]").forEach((b) => (b.onclick = () => markLost(b.dataset.lost)));
  list.querySelectorAll("[data-editlead]").forEach((b) => (b.onclick = () => { const c = LEADS.find((l) => l.id === b.dataset.editlead); if (c) clientForm(c); }));
}
function leadCard(c) {
  const fups = FUPS[c.id] || [];
  const contact = [c.instagram, c.phone, c.email].filter(Boolean)[0] || "";
  const chips = fups.map((f) => { const st = fupState(f); return `<button class="fu-chip fu-${st}" data-fu="${f.id}" title="${escAttr(f.due_date || "")}">${esc(f.label || "Follow-up")}</button>`; }).join("");
  const since = c.enquiry_date ? esc(c.enquiry_date) : "no date";
  return `<div class="ob-card">
    <div class="ob-card-top">
      <div><h3>${esc(c.name)}</h3><div class="ob-meta"><span class="badge src">${esc(srcLabel(c.source))}</span> <span class="ob-since">Enquiry ${since}</span>${contact ? ` <span class="ob-since">${esc(contact)}</span>` : ""}</div></div>
      <div class="ob-card-actions"><button class="btn btn-ghost btn-sm" data-editlead="${c.id}">Edit</button><button class="btn btn-ghost btn-sm" data-lost="${c.id}">Lost</button><button class="btn btn-primary btn-sm" data-convert="${c.id}">Convert</button></div>
    </div>
    ${c.notes ? `<div class="ob-note">${esc(c.notes)}</div>` : ""}
    <div class="fu-row">${chips || '<span class="ob-since">No follow-ups scheduled.</span>'}</div>
  </div>`;
}
function findFup(id) { for (const arr of Object.values(FUPS)) { const f = arr.find((x) => x.id === id); if (f) return f; } return null; }
function followupModal(id) {
  const f = findFup(id); if (!f) return;
  const lead = LEADS.find((l) => l.id === f.client_id);
  const done = f.status === "done";
  modal(`<h3>${esc(f.label || "Follow-up")}${lead ? " for " + esc(lead.name) : ""}</h3>
    <p style="color:var(--muted);font-size:0.82rem;margin:-8px 0 14px">${f.due_date ? "Due " + esc(f.due_date) : ""}${lead && lead.source ? " via " + esc(srcLabel(lead.source)) : ""}</p>
    <label class="fld"><span>Draft message (tweak before sending if you like)</span><textarea id="fu-msg" rows="5">${esc(f.draft_message || "")}</textarea></label>
    <div class="actions"><button class="btn btn-ghost btn-sm" id="fu-copy">Copy</button><div style="flex:1"></div><button class="btn btn-ghost" id="fu-cancel">Close</button><button class="btn ${done ? "btn-ghost" : "btn-primary"}" id="fu-done">${done ? "Mark not done" : "Mark done"}</button></div>`);
  $("fu-cancel").onclick = closeModal;
  $("fu-copy").onclick = async () => { const ok = await copyText(val("fu-msg")); toast(ok ? "Copied" : "Copy failed"); };
  $("fu-done").onclick = async () => {
    const nowDone = !done;
    const res = await supa.from("follow_ups").update({ status: nowDone ? "done" : "pending", done_at: nowDone ? new Date().toISOString() : null, draft_message: val("fu-msg") }).eq("id", f.id);
    if (res.error) { toast(res.error.message); return; }
    closeModal(); toast(nowDone ? "Marked done" : "Reopened"); viewOnboarding();
  };
}
async function convertLead(id) {
  const c = LEADS.find((l) => l.id === id);
  if (!confirm("Convert " + (c ? c.name : "this enquiry") + " to an active client? Pending follow-ups are cleared.")) return;
  await supa.from("clients").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", id);
  await supa.from("follow_ups").update({ status: "dismissed" }).eq("client_id", id).eq("kind", "lead_nudge").eq("status", "pending");
  toast("Converted to active client"); viewOnboarding();
}
async function markLost(id) {
  if (!confirm("Mark this enquiry as lost? It moves to Past and pending follow-ups are cleared.")) return;
  await supa.from("clients").update({ status: "past", updated_at: new Date().toISOString() }).eq("id", id);
  await supa.from("follow_ups").update({ status: "dismissed" }).eq("client_id", id).eq("kind", "lead_nudge").eq("status", "pending");
  toast("Marked lost"); viewOnboarding();
}
function enquiryForm() {
  modal(`<h3>New enquiry</h3>
    <label class="fld"><span>Name</span><input id="e-name" placeholder="Client or artist name" /></label>
    <label class="fld"><span>Came in via</span><select id="e-source">${SOURCES.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
    <label class="fld"><span>Contact (WhatsApp number, IG handle or email)</span><input id="e-contact" placeholder="082... / @handle / name@email.com" /></label>
    <label class="fld"><span>Enquiry date</span><input type="date" id="e-date" /></label>
    <label class="fld"><span>What do they want? (optional)</span><textarea id="e-note" rows="2" placeholder="e.g. music video, 2 reels, shoot in Nov"></textarea></label>
    <div class="bld-note-sm">We'll auto-schedule follow-ups for day 1, 3, 7 and 14 with ready-to-send drafts.</div>
    <div class="actions"><div style="flex:1"></div><button class="btn btn-ghost" id="e-cancel">Cancel</button><button class="btn btn-primary" id="e-save">Log enquiry</button></div>`);
  $("e-date").value = isoDate(today0());
  $("e-cancel").onclick = closeModal;
  $("e-save").onclick = async () => {
    const name = val("e-name"); if (!name) { toast("Name is required"); return; }
    const source = $("e-source").value;
    const contact = val("e-contact");
    const edate = val("e-date") || isoDate(today0());
    const client = { name, type: "artist", status: "lead", source, enquiry_date: edate, notes: val("e-note") };
    if (contact) {
      if (contact.includes("@") && contact.includes(".")) client.email = contact;
      else if (contact.charAt(0) === "@" || source === "instagram") client.instagram = contact;
      else client.phone = contact;
    }
    const u = (await supa.auth.getUser()).data.user;
    const ins = await supa.from("clients").insert({ ...client, created_by: u ? u.id : null }).select().single();
    if (ins.error) { toast(ins.error.message); return; }
    const base = new Date(edate + "T00:00:00");
    const rows = followupPlan(name).map((p) => { const d = new Date(base); d.setDate(d.getDate() + p.offset); return { client_id: ins.data.id, kind: "lead_nudge", label: p.label, due_date: isoDate(d), draft_message: p.msg, status: "pending" }; });
    await supa.from("follow_ups").insert(rows);
    closeModal(); toast("Enquiry logged with follow-ups"); viewOnboarding();
  };
}

/* ---------- Priority GO (opened from the logo) ---------- */
let PRIO = [];
function dueClass(d) {
  if (!d) return "";
  const t = isoDate(today0());
  if (d < t) return "pr-over";
  const diff = (new Date(d + "T00:00:00") - new Date(t + "T00:00:00")) / 86400000;
  return diff <= 2 ? "pr-soon" : "";
}
async function viewPriority() {
  setActiveNav("priority");
  setView(`<div class="view-head"><div class="pr-eyebrow">Priority GO</div><div class="spacer"></div><button class="btn btn-primary" id="pr-add">New item</button></div>
    <div id="pr-wrap"><div class="empty">Loading...</div></div>`);
  $("pr-add").onclick = () => priorityForm();
  const { data, error } = await supa.from("priority_items").select("*").eq("done", false).order("rank", { ascending: true }).order("created_at", { ascending: true });
  const wrap = $("pr-wrap");
  if (error) { wrap.innerHTML = `<div class="empty"><div class="big">Couldn't load</div><p>${esc(error.message)}</p><p style="margin-top:8px">If this is the first time, run migrate-phase4.sql in Supabase.</p></div>`; return; }
  PRIO = data || [];
  renderPriority();
}
function renderPriority() {
  const wrap = $("pr-wrap");
  if (!PRIO.length) { wrap.innerHTML = `<div class="empty"><div class="big">Nothing on the list</div><p>Add your top priorities. Link them to a project, client or enquiry, or just write a quick to-do.</p></div>`; return; }
  const top = PRIO.slice(0, 5), rest = PRIO.slice(5);
  let h = `<div class="pr-top">${top.map((it, i) => prioCard(it, i)).join("")}</div>`;
  if (rest.length) h += `<div class="section-title">Also on the list</div><div class="rows">${rest.map((it, i) => prioRow(it, i + 5)).join("")}</div>`;
  wrap.innerHTML = h;
  wirePriority(wrap);
}
function prioLinkChip(it) {
  return it.link_type ? `<button class="pr-link" data-golink="${esc(it.link_type)}:${esc(it.link_id || "")}">${esc(cap(it.link_type))}: ${esc(it.link_label || "")}</button>` : "";
}
function prioDue(it) {
  return it.due_date ? `<span class="pr-due ${dueClass(it.due_date)}">Due ${esc(it.due_date)}</span>` : "";
}
function prioActions(it, idx) {
  return `<div class="pr-actions"><button class="btn btn-primary btn-sm" data-done="${it.id}">Done</button><button class="btn btn-ghost btn-sm" data-up="${idx}" ${idx === 0 ? "disabled" : ""}>Up</button><button class="btn btn-ghost btn-sm" data-down="${idx}" ${idx === PRIO.length - 1 ? "disabled" : ""}>Down</button><button class="btn btn-ghost btn-sm" data-edit="${it.id}">Edit</button><button class="btn btn-danger btn-sm" data-del="${it.id}">Delete</button></div>`;
}
function prioCard(it, idx) {
  return `<div class="pr-card"><div class="pr-rank">${idx + 1}</div><div class="pr-title">${esc(it.title)}</div><div class="pr-meta">${prioDue(it)}${prioLinkChip(it)}</div>${prioActions(it, idx)}</div>`;
}
function prioRow(it, idx) {
  return `<div class="row"><div class="title">${esc(it.title)} ${prioDue(it)} ${prioLinkChip(it)}</div><div class="spacer"></div>${prioActions(it, idx)}</div>`;
}
function wirePriority(wrap) {
  wrap.querySelectorAll("[data-done]").forEach((b) => (b.onclick = async () => {
    const res = await supa.from("priority_items").update({ done: true, done_at: new Date().toISOString() }).eq("id", b.dataset.done);
    if (res.error) { toast(res.error.message); return; }
    toast("Done"); viewPriority();
  }));
  wrap.querySelectorAll("[data-up]").forEach((b) => (b.onclick = () => moveItem(+b.dataset.up, -1)));
  wrap.querySelectorAll("[data-down]").forEach((b) => (b.onclick = () => moveItem(+b.dataset.down, 1)));
  wrap.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => { const it = PRIO.find((x) => x.id === b.dataset.edit); if (it) priorityForm(it); }));
  wrap.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
    if (!confirm("Remove this item?")) return;
    const res = await supa.from("priority_items").delete().eq("id", b.dataset.del);
    if (res.error) { toast(res.error.message); return; }
    toast("Removed"); viewPriority();
  }));
  wrap.querySelectorAll("[data-golink]").forEach((b) => (b.onclick = () => {
    const [lt, lid] = b.dataset.golink.split(":");
    if (lt === "project" && lid) location.hash = "#/projects/" + lid;
    else if (lt === "client" && lid) location.hash = "#/clients/" + lid;
    else location.hash = "#/onboarding";
  }));
}
async function moveItem(idx, dir) {
  const j = idx + dir;
  if (j < 0 || j >= PRIO.length) return;
  const arr = PRIO.slice();
  const tmp = arr[idx]; arr[idx] = arr[j]; arr[j] = tmp;
  PRIO = arr;
  renderPriority();
  const updates = arr.map((it, i) => (it.rank !== i ? supa.from("priority_items").update({ rank: i }).eq("id", it.id) : null)).filter(Boolean);
  arr.forEach((it, i) => (it.rank = i));
  await Promise.all(updates);
}
async function priorityForm(item) {
  const it = item || {};
  modal(`<h3>${item ? "Edit item" : "New priority"}</h3>
    <label class="fld"><span>What needs doing?</span><input id="pi-title" value="${escAttr(it.title || "")}" placeholder="e.g. Send Beezlo Boys the final cut" /></label>
    <label class="fld"><span>Link to (optional)</span><select id="pi-ltype"><option value="">Nothing</option><option value="project">Project</option><option value="client">Client</option><option value="enquiry">Enquiry</option></select></label>
    <label class="fld" id="pi-lwrap" style="display:none"><span>Which one?</span><select id="pi-lid"></select></label>
    <label class="fld"><span>Due date (optional)</span><input type="date" id="pi-due" value="${escAttr(it.due_date || "")}" /></label>
    <div class="actions">${item ? `<button class="btn btn-danger btn-sm" id="pi-del">Delete</button>` : ""}<div style="flex:1"></div><button class="btn btn-ghost" id="pi-cancel">Cancel</button><button class="btn btn-primary" id="pi-save">Save</button></div>`);
  $("pi-cancel").onclick = closeModal;
  const loadOptions = async (type, selId) => {
    let rows = [];
    if (type === "project") rows = ((await supa.from("projects").select("id,title").order("created_at", { ascending: false })).data || []).map((r) => [r.id, r.title]);
    else if (type === "client") rows = ((await supa.from("clients").select("id,name").order("name")).data || []).map((r) => [r.id, r.name]);
    else if (type === "enquiry") rows = ((await supa.from("clients").select("id,name").eq("status", "lead").order("name")).data || []).map((r) => [r.id, r.name]);
    $("pi-lid").innerHTML = rows.map(([v, l]) => `<option value="${escAttr(v)}" ${selId === v ? "selected" : ""}>${esc(l)}</option>`).join("") || `<option value="">None found</option>`;
  };
  $("pi-ltype").onchange = async () => {
    const t = $("pi-ltype").value;
    $("pi-lwrap").style.display = t ? "block" : "none";
    if (t) await loadOptions(t);
  };
  if (it.link_type) { $("pi-ltype").value = it.link_type; $("pi-lwrap").style.display = "block"; await loadOptions(it.link_type, it.link_id); }
  $("pi-save").onclick = async () => {
    const title = val("pi-title"); if (!title) { toast("Add a title"); return; }
    const lt = $("pi-ltype").value;
    const payload = { title, due_date: val("pi-due") || null, link_type: lt || null, link_id: lt ? ($("pi-lid").value || null) : null, link_label: lt ? ($("pi-lid").options[$("pi-lid").selectedIndex] || {}).text || null : null };
    let res;
    if (item) res = await supa.from("priority_items").update(payload).eq("id", item.id);
    else res = await supa.from("priority_items").insert({ ...payload, rank: PRIO.length });
    if (res.error) { toast(res.error.message); return; }
    closeModal(); toast("Saved"); viewPriority();
  };
  if (item) $("pi-del").onclick = async () => {
    const res = await supa.from("priority_items").delete().eq("id", item.id);
    if (res.error) { toast(res.error.message); return; }
    closeModal(); toast("Removed"); viewPriority();
  };
}

/* ---------- deliveries tab (all deliveries) ---------- */
async function viewDeliveries() {
  setActiveNav("deliveries");
  setView(`<div class="view-head"><h2>Deliveries</h2><div class="spacer"></div><button class="btn btn-primary" id="new-delivery-tab">New delivery</button></div><div id="dlv-all"><div class="empty">Loading...</div></div>`);
  $("new-delivery-tab").onclick = () => deliveryForm({ pickClient: true, onDone: viewDeliveries });
  const box = $("dlv-all");
  const { data, error } = await supa.from("deliveries").select("*, clients(name), projects(title)").order("created_at", { ascending: false });
  if (error) { box.innerHTML = `<div class="empty"><div class="big">Couldn't load</div><p>${esc(error.message)}</p></div>`; return; }
  const rows = data || [];
  if (!rows.length) { box.innerHTML = `<div class="empty"><div class="big">No deliveries yet</div><p>Hit "New delivery" above, or make one from inside a project. Links built with the standalone <a href="/deliver-new.html" target="_blank" rel="noopener">builder</a> while you're logged in show up here too.</p></div>`; return; }
  box.innerHTML = `<div class="rows">${rows.map((d) => {
    const when = String(d.delivered_at || d.created_at || "").slice(0, 10);
    const name = d.clients ? d.clients.name : "";
    return `<div class="row" data-pid="${d.project_id || ""}"><div class="title">${esc(d.title || (d.projects ? d.projects.title : "Delivery"))}${name ? `<div class="dlv-sub">${esc(name)}</div>` : ""}</div><span class="date">${esc(when)}</span><div class="spacer"></div>${deliveryBtns(d, name)}</div>`;
  }).join("")}</div>`;
  wireDeliveryButtons(box, viewDeliveries);
  box.querySelectorAll(".row").forEach((r) => { if (r.dataset.pid) { r.style.cursor = "pointer"; r.onclick = (e) => { if (e.target.closest("a,button")) return; location.hash = "#/projects/" + r.dataset.pid; }; } });
}

/* ---------- boot ---------- */
(async function init() {
  const { data: { session } } = await supa.auth.getSession();
  if (session) showApp(session); else showLogin();
  supa.auth.onAuthStateChange((_event, s) => { if (s) showApp(s); else showLogin(); });
})();
