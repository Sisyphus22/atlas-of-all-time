// Gives the Atlas page the same `claude.use()` surface it has on claude.ai,
// backed by the desktop shell: Claude via the user's API key, and a local
// database and media store on this computer. Also adds the Claude settings panel.
(() => {
  "use strict";
  const A = window.atlasApp;
  if (!A) return;
  const META = { fromCache: false, hasPendingWrites: false };
  const newId = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");

  /* ---------- sample (ask Claude) ---------- */
  function sample(input, opts) {
    opts = opts || {};
    const prompt = typeof input === "string" ? input : (input || []).map((m) => m.content).join("\n\n");
    const id = newId(12);
    return new Promise((resolve, reject) => {
      let last = "";
      if (opts.signal) {
        if (opts.signal.aborted) { reject({ code: "cancelled", message: "Stopped" }); return; }
        opts.signal.addEventListener("abort", () => A.abort(id), { once: true });
      }
      A.ask(id, prompt, (text) => {
        const delta = text.slice(last.length); last = text;
        if (delta && typeof opts.onText === "function") { try { opts.onText({ text, delta }); } catch (e) { console.error(e); } }
      }).then((r) => {
        if (r && r.ok) { resolve({ text: r.text, truncated: !!r.truncated, modelTierApplied: "complex" }); return; }
        const err = { code: (r && r.code) || "upstream_error", message: (r && r.message) || "" };
        if (last && err.code !== "refused") err.text = last;
        if (err.code === "no_key" || err.code === "invalid_key") openSettings(err.code);
        reject(err);
      }, (e) => reject({ code: "upstream_error", message: String(e) }));
    });
  }
  sample.json = async (input, opts) => { const r = await sample(input, opts); const m = r.text.match(/[\[{][\s\S]*[\]}]/); return JSON.parse(m ? m[0] : r.text); };
  sample.limits = async () => ({ maxPromptBytes: 262144, modelTiers: ["default", "complex", "quick"] });

  /* ---------- local db ---------- */
  const subs = new Map();
  async function emit(col) {
    const set = subs.get(col); if (!set || !set.size) return;
    const docs = await A.dbList(col);
    const list = Object.keys(docs).sort().map((id) => ({ id, exists: true, data: () => docs[id], metadata: META }));
    const snap = { docs: list, size: list.length, empty: !list.length, metadata: META, docChanges: () => [] };
    set.forEach((f) => { try { f(snap); } catch (e) { console.error(e); } });
  }
  A.onDbChange((col) => emit(col));
  const db = {
    doc(p) {
      const i = p.lastIndexOf("/"); const col = p.slice(0, i), id = p.slice(i + 1);
      return {
        id, path: p,
        set: async (d) => { const r = await A.dbSet(col, id, JSON.parse(JSON.stringify(d))); if (!r.ok) throw { code: "invalid_argument" }; },
        update: async (d) => { const all = await A.dbList(col); if (!all[id]) throw { code: "invalid_argument" }; await A.dbSet(col, id, Object.assign({}, all[id], JSON.parse(JSON.stringify(d)))); },
        delete: () => A.dbDelete(col, id),
        get: async () => { const all = await A.dbList(col); const d = all[id]; return { id, exists: !!d, data: () => d, metadata: META }; },
      };
    },
    collection(col) {
      return {
        path: col,
        doc: (id) => db.doc(col + "/" + (id || newId(10))),
        add: async (d) => { const ref = db.doc(col + "/" + newId(10)); await ref.set(d); return ref; },
        onSnapshot(next, error) {
          if (!subs.has(col)) subs.set(col, new Set());
          subs.get(col).add(next);
          emit(col).catch(() => error && error({ code: "unavailable" }));
          return () => subs.get(col).delete(next);
        },
      };
    },
  };

  /* ---------- local media ---------- */
  const assets = {
    async upload(blob, options) {
      const type = (options && options.type) || blob.type;
      const r = await A.upload(new Uint8Array(await blob.arrayBuffer()), type);
      if (!r.ok) throw { code: r.code, message: r.message };
      return { id: r.id, url: "/_blob/" + r.id, sizeBytes: r.size, contentType: type };
    },
  };

  window.claude = { use: async (name) => (name === "sample" ? sample : name === "db" ? db : name === "assets" ? assets : null) };

  /* ---------- Claude settings panel ---------- */
  const css = `
  .app-gear{position:fixed;top:14px;right:max(16px,env(safe-area-inset-right,0px));z-index:15;display:inline-flex;align-items:center;gap:8px;background:var(--panel-2);border:1px solid var(--line);border-radius:999px;padding:7px 13px;font:500 13px var(--ui);color:var(--fg);cursor:pointer}
  .app-gear:hover{border-color:var(--gold)}
  .app-gear i{width:8px;height:8px;border-radius:50%;background:var(--dim)}
  .app-gear.on i{background:#7fd38a}
  .app-set{max-width:560px}
  .app-set .modal-body p{color:var(--muted);font-size:14px;margin:8px 0 0}
  .app-set ol{color:var(--muted);font-size:14px;padding-left:20px;margin:10px 0 0}
  .app-set .ok{color:#7fd38a;font-size:13.5px}
  `;
  let gear, settingsOpen = false;
  function h(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (v == null) continue; if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else if (k === "class") n.className = v; else n.setAttribute(k, v); }
    kids.flat().forEach((c) => c != null && n.append(c instanceof Node ? c : document.createTextNode(String(c))));
    return n;
  }
  async function refreshGear() {
    const s = await A.settings();
    gear.classList.toggle("on", s.hasKey);
    gear.lastChild.textContent = s.hasKey ? "Claude connected" : "Connect Claude";
  }
  async function openSettings(reason) {
    if (settingsOpen) return;
    const overlay = document.getElementById("overlay"), modal = document.getElementById("modal");
    if (!overlay || !modal) return;
    settingsOpen = true;
    const s = await A.settings();
    const status = h("p", { role: "status" });
    const key = h("input", { id: "apiKey", type: "password", autocomplete: "off", spellcheck: "false", placeholder: s.hasKey ? "A key is saved. Paste a new one to replace it." : "sk-ant-…" });
    const model = h("select", { id: "apiModel" }, Object.entries(s.models).map(([v, label]) => h("option", { value: v }, label)));
    model.value = s.model;
    model.addEventListener("change", async () => { await A.setModel(model.value); status.className = "ok"; status.textContent = "Model saved."; });
    const save = h("button", { class: "btn primary", type: "submit" }, "Save key");
    const form = h("form", { class: "modal-body" },
      h("div", { class: "eyebrow" }, "Claude settings"),
      h("h3", { id: "modalTitle" }, s.hasKey ? "Claude is connected" : "Connect Claude"),
      reason === "invalid_key" ? h("p", { class: "err" }, "Your saved key was rejected. Paste a working key.") : null,
      h("p", null, "Ask Claude uses your own Anthropic API key. You pay Anthropic per question; there's no subscription. Everything else in the Atlas works without a key."),
      h("ol", null,
        h("li", null, "Create an account and add credit at the Anthropic Console."),
        h("li", null, "Create an API key and paste it below.")),
      h("div", { class: "modal-actions" }, h("button", { class: "btn", type: "button", onclick: () => A.openKeysPage() }, "Open the Anthropic Console")),
      h("div", { class: "field" }, h("label", { for: "apiKey" }, "API key"), key),
      h("div", { class: "field" }, h("label", { for: "apiModel" }, "Model"), model),
      h("p", { class: "small" }, "The key is encrypted with your Windows account and stays on this computer. It's only sent to Anthropic."),
      status,
      h("div", { class: "modal-actions" }, save,
        s.hasKey && !s.fromEnv ? h("button", { class: "btn ghost", type: "button", onclick: async () => { await A.clearKey(); await refreshGear(); close(); } }, "Remove key") : null,
        h("button", { class: "btn ghost", type: "button", onclick: () => close() }, "Close")));
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); status.className = ""; status.textContent = "Checking the key…"; save.disabled = true;
      const r = await A.setKey(key.value);
      save.disabled = false;
      if (r.ok) { status.className = "ok"; status.textContent = "Key saved. Claude is connected."; key.value = ""; await refreshGear(); setTimeout(close, 900); }
      else { status.className = "err"; status.textContent = r.message; }
    });
    const prevClass = modal.className;
    modal.className = "modal app-set"; modal.replaceChildren(h("button", { class: "x", type: "button", "aria-label": "Close", onclick: () => close() }, "×"), form);
    overlay.hidden = false; key.focus();
    function onKey(e) { if (e.key === "Escape") close(); }
    function onBackdrop(e) { if (e.target === overlay) close(); }
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("click", onBackdrop);
    function close() { settingsOpen = false; overlay.hidden = true; modal.className = prevClass; document.removeEventListener("keydown", onKey); overlay.removeEventListener("click", onBackdrop); gear.focus(); }
  }
  document.addEventListener("DOMContentLoaded", () => {
    document.head.append(h("style", null, css));
    gear = h("button", { class: "app-gear", type: "button", onclick: () => openSettings() }, h("i"), h("span", null, "Connect Claude"));
    document.body.append(gear);
    refreshGear();
  });
})();
