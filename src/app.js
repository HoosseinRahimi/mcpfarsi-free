/* Open MCP Bazaar — static edition
   All logic runs in the browser. No network calls, no storage outside localStorage. */
(function () {
  "use strict";

  var DATA = JSON.parse(document.getElementById("data-catalog").textContent);
  var COPY = JSON.parse(document.getElementById("data-copy").textContent);
  var SERVERS = DATA.servers;
  var GROUPS = DATA.groups;
  var UI = COPY.ui;

  var FA = "۰۱۲۳۴۵۶۷۸۹";
  var state = {
    lang: "fa",
    theme: "dark",
    q: "",
    group: "all",
    sort: "default",
    picked: new Set(),
    expanded: new Set()
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function t(key) {
    var pack = UI[state.lang] || UI.fa;
    return pack[key] != null ? pack[key] : (UI.en[key] != null ? UI.en[key] : key);
  }
  function faNum(n) {
    return state.lang === "fa" ? String(n).replace(/[0-9]/g, function (d) { return FA[+d]; }) : String(n);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(tpl, map) {
    return String(tpl).replace(/\{(\w+)\}/g, function (_, k) { return map[k] != null ? map[k] : ""; });
  }

  /* ---------- search normalization (Persian + Latin) ---------- */
  var DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;
  function norm(s) {
    if (!s) return "";
    var out = String(s).toLowerCase();
    out = out.replace(/[\u06F0-\u06F9]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); });
    out = out.replace(/[\u0660-\u0669]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); });
    out = out.replace(DIACRITICS, "");
    out = out.replace(/\u064A/g, "\u06CC").replace(/\u0643/g, "\u06A9");
    out = out.replace(/[\u0622\u0623\u0625\u0627]/g, "\u0627");
    out = out.replace(/\u0629/g, "\u0647");
    out = out.replace(/\u200C/g, " ");
    out = out.replace(/[\u200E\u200F\u202A-\u202E]/g, "");
    out = out.replace(/\s+/g, " ").trim();
    return out;
  }

  var index = SERVERS.map(function (s) {
    var fa = (COPY.servers && COPY.servers[s.name]) || ["", ""];
    var hay = [
      s.name, s.title, s.pkg, s.description, fa[0], fa[1], s.category,
      (s.tools || []).map(function (x) { return x.name + " " + (x.title || ""); }).join(" ")
    ].join(" ");
    return { s: s, fa: fa, hay: norm(hay) };
  });

  function groupOf(cat) {
    for (var i = 0; i < GROUPS.length; i++) {
      if (GROUPS[i].cats.indexOf(cat) !== -1) return GROUPS[i].id;
    }
    return "other";
  }
  function groupLabel(id) {
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].id === id) return GROUPS[i][state.lang] || GROUPS[i].fa;
    return id;
  }
  function titleOf(rec) { return state.lang === "fa" && rec.fa[0] ? rec.fa[0] : rec.s.title; }
  function descOf(rec) { return state.lang === "fa" && rec.fa[1] ? rec.fa[1] : rec.s.description; }

  /* ---------- filtering ---------- */
  function filtered() {
    var q = norm(state.q);
    var rows = index.filter(function (rec) {
      if (state.group !== "all" && groupOf(rec.s.category) !== state.group) return false;
      if (!q) return true;
      return rec.hay.indexOf(q) !== -1;
    });
    if (state.sort === "tools") {
      rows.sort(function (a, b) { return b.s.tool_count - a.s.tool_count; });
    } else if (state.sort === "name") {
      rows.sort(function (a, b) { return String(a.s.name).localeCompare(String(b.s.name)); });
    }
    return rows;
  }

  /* ---------- rendering ---------- */
  var gridEl = $("#grid");
  var countEl = $("#count");
  var emptyEl = $("#empty");

  var ICON = {
    search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>',
    copy: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    gh: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.1.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.69 0 3.85-2.35 4.7-4.58 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z"/></svg>',
    chev: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    moon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
    sun: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>',
    close: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>'
  };

  function envSummary(s) {
    var req = (s.env || []).filter(function (e) { return e.isRequired; }).map(function (e) { return e.name; });
    var opt = (s.env || []).filter(function (e) { return !e.isRequired; }).map(function (e) { return e.name; });
    if (req.length) return { cls: "env", label: fmt(t("env_need"), { names: req.join(", ") }) };
    if (opt.length) return { cls: "env", label: fmt(t("env_optional"), { names: opt.join(", ") }), optional: true };
    return { cls: "env", label: t("env_none"), none: true };
  }

  function cardHtml(rec, idn) {
    var s = rec.s;
    var picked = state.picked.has(s.name);
    var isRemote = !!s.url;
    var env = envSummary(s);
    var tags = [
      '<span class="tag">' + faNum(s.tool_count) + " " + esc(t("stat_tools")) + "</span>",
      s.read_only
        ? '<span class="tag tag-ok">' + esc(t("readonly_yes")) + "</span>"
        : '<span class="tag tag-warn">' + esc(t("readonly_no")) + "</span>"
    ];
    if (isRemote) tags.push('<span class="tag tag-hosted">' + esc(t("hosted_tag")) + "</span>");

    return (
      '<article class="card' + (picked ? " is-picked" : "") + '" data-name="' + esc(s.name) + '">' +
        '<div class="card-top">' +
          '<h3 class="ttl"><a href="' + esc(s.repository) + '" target="_blank" rel="noopener noreferrer">' + esc(titleOf(rec)) + "</a></h3>" +
          '<span class="ver">v' + esc(s.version) + "</span>" +
        "</div>" +
        '<div class="pkgi">' + (s.url
            ? '<bdi dir="ltr">' + esc(s.url.replace(/^https?:\/\//, "")) + "</bdi>"
            : '<bdi dir="ltr">' + esc(s.pkg) + "</bdi>") +
          '<span class="cat">· ' + esc(groupLabel(groupOf(s.category))) + "</span></div>" +
        '<p class="desc">' + esc(descOf(rec)) + "</p>" +
        '<div class="meta">' + tags.join("") + "</div>" +
        '<div class="actions">' +
          '<button class="abtn" data-act="tools" aria-expanded="' + (state.expanded.has(s.name) ? "true" : "false") + '" aria-controls="tb-' + idn + '">' +
            (state.expanded.has(s.name) ? esc(t("tools_hide")) : fmt(t("tools_btn"), { n: faNum(s.tool_count) })) + " " + ICON.chev +
          "</button>" +
          '<button class="abtn icon" data-act="copy" title="' + esc(isRemote ? t("remote_copy") : t("install_copy")) + '" aria-label="' + esc(isRemote ? t("remote_copy") : t("install_copy")) + '">' + ICON.copy + "</button>" +
          '<a class="abtn icon" href="' + esc(s.repository) + '" target="_blank" rel="noopener noreferrer" title="' + esc(t("open_repo")) + '" aria-label="' + esc(t("open_repo")) + '">' + ICON.gh + "</a>" +
          (isRemote
            ? '<span class="abtn grow" aria-disabled="true" title="' + esc(t("remote_only")) + '">' + esc(t("hosted_tag")) + "</span>"
            : '<button class="abtn grow' + (picked ? " on" : "") + '" data-act="pick" aria-pressed="' + (picked ? "true" : "false") + '">' +
              (picked ? esc(t("added_btn")) : esc(t("add_btn"))) +
              "</button>") +
        "</div>" +
        '<div class="toolbox" id="tb-' + idn + '" tabindex="0" role="group" aria-label="' + esc(titleOf(rec)) + ' — ' + esc(fmt(t("tools_btn"), { n: faNum(s.tool_count) })) + '"' + (state.expanded.has(s.name) ? "" : " hidden") + ">" + toolsHtml(s, env) + "</div>" +
      "</article>"
    );
  }

  function toolsHtml(s, env) {
    var rows = (s.tools || []).map(function (x) {
      return (
        '<div class="tool">' +
          '<span class="tool-name">' + esc(x.name) + "</span>" +
          '<span class="tool-t">' + esc(x.title || "") + "</span>" +
          '<div class="tool-sum">' + esc(x.summary || "") + "</div>" +
        "</div>"
      );
    }).join("");
    var envLine;
    if (s.url) {
      envLine = '<div class="envline"><b>http</b><span>' + esc(s.url) + " · " +
        esc(t("auth_label")) + ": " + esc(s.auth || "none") + "</span></div>";
    } else {
      envLine = '<div class="envline"><b>' + (env.none ? "—" : "env") + "</b><span>" + esc(env.label) + "</span></div>";
    }
    return rows + envLine;
  }

  function renderChips() {
    var total = SERVERS.length;
    var html = ['<button class="chip" data-group="all" aria-pressed="' + (state.group === "all") + '">' +
      esc(t("filter_all")) + ' <span class="n">' + faNum(total) + "</span></button>"];
    GROUPS.forEach(function (g) {
      var n = SERVERS.filter(function (s) { return groupOf(s.category) === g.id; }).length;
      if (!n) return;
      html.push('<button class="chip" data-group="' + esc(g.id) + '" aria-pressed="' + (state.group === g.id) + '">' +
        esc(g[state.lang] || g.fa) + ' <span class="n">' + faNum(n) + "</span></button>");
    });
    $("#chips").innerHTML = html.join("");
  }

  function render() {
    var rows = filtered();
    var idIndex = {};
    SERVERS.forEach(function (s, i) { idIndex[s.name] = "c" + i; });

    gridEl.innerHTML = rows.map(function (rec) { return cardHtml(rec, idIndex[rec.s.name]); }).join("");

    var tools = rows.reduce(function (n, r) { return n + r.s.tool_count; }, 0);
    var label = rows.length === SERVERS.length
      ? fmt(t("count"), { n: faNum(rows.length), t: faNum(tools) })
      : fmt(t("count_filtered"), { n: faNum(rows.length), all: faNum(SERVERS.length), t: faNum(tools) });
    countEl.textContent = label;
    countEl.setAttribute("aria-label", label);

    var showEmpty = rows.length === 0;
    emptyEl.hidden = !showEmpty;
    if (showEmpty) {
      $("#empty-title").textContent = fmt(t("empty_title"), { q: state.q });
      $("#empty-body").textContent = t("empty_body");
      $("#empty-clear").textContent = t("empty_clear");
    }
    renderChips();
    updateDock();
    $$(".chip").forEach(function (c) {
      c.setAttribute("aria-pressed", String(c.getAttribute("data-group") === state.group));
    });
  }

  /* ---------- selection dock ---------- */
  function updateDock() {
    var n = state.picked.size;
    var dock = $("#dock");
    dock.classList.toggle("on", n > 0);
    dock.setAttribute("aria-hidden", n > 0 ? "false" : "true");
    $("#dock-label").innerHTML = fmt(t("dock_count"), { n: "<b>" + faNum(n) + "</b>" });
    $("#dock-build").textContent = t("dock_build");
    $("#dock-clear").textContent = t("dock_clear");
  }

  /* ---------- config generation ---------- */
  var CLIENTS = [
    { id: "claude-desktop", name: "Claude Desktop", file: "claude_desktop_config.json",
      path: { fa: "Settings › Developer › Edit Config", en: "Settings › Developer › Edit Config" } },
    { id: "claude-code", name: "Claude Code", file: ".mcp.json",
      path: { fa: "ریشهٔ پروژه: .mcp.json یا دستور claude mcp add", en: "project root: .mcp.json, or claude mcp add" } },
    { id: "cursor", name: "Cursor", file: "mcp.json",
      path: { fa: "~/.cursor/mcp.json", en: "~/.cursor/mcp.json" } },
    { id: "vscode", name: "VS Code", file: "mcp.json",
      path: { fa: ".vscode/mcp.json", en: ".vscode/mcp.json" } },
    { id: "windsurf", name: "Windsurf", file: "mcp_config.json",
      path: { fa: "~/.codeium/windsurf/mcp_config.json", en: "~/.codeium/windsurf/mcp_config.json" } }
  ];
  var activeClient = "claude-desktop";

  function serverEntry(s) {
    var env = {};
    (s.env || []).forEach(function (e) {
      if (e.isRequired) env[e.name] = e.isSecret ? "<YOUR_KEY>" : "<VALUE>";
    });
    var entry = { command: "uvx", args: [s.pkg] };
    if (Object.keys(env).length) entry.env = env;
    return entry;
  }

  function buildConfig() {
    var picked = SERVERS.filter(function (s) { return state.picked.has(s.name); });
    var map = {};
    picked.forEach(function (s) { map[s.name] = serverEntry(s); });

    if (activeClient === "vscode") {
      var servers = {};
      picked.forEach(function (s) {
        var e = serverEntry(s);
        servers[s.name] = { type: "stdio", command: e.command, args: e.args };
        if (e.env) servers[s.name].env = e.env;
      });
      return JSON.stringify({ servers: servers }, null, 2);
    }
    return JSON.stringify({ mcpServers: map }, null, 2);
  }

  function renderDialog() {
    var picked = state.picked.size;
    $("#dlg-empty").hidden = picked > 0;
    $("#dlg-out").hidden = picked === 0;
    if (!picked) {
      $("#dlg-empty").textContent = t("dialog_empty");
      return;
    }

    $("#tabs").setAttribute("role", "group");
    $("#tabs").innerHTML = CLIENTS.map(function (c) {
      return '<button class="tab" type="button" data-client="' + c.id + '" aria-pressed="' + (c.id === activeClient) + '">' + esc(c.name) + "</button>";
    }).join("");

    var cfg = buildConfig();
    $("#dlg-code").textContent = cfg;
    var client = CLIENTS.filter(function (c) { return c.id === activeClient; })[0];
    var pathLabel = client.id === "claude-desktop" ? t("dialog_path_menu") : t("dialog_path");
    $("#dlg-path").innerHTML = esc(pathLabel) + ": <code>" + esc(client.path[state.lang] || client.path.en) + "</code>";
    $("#dlg-copy").textContent = t("dialog_copy");
    $("#dlg-dl").textContent = t("dialog_download");
    $("#secret-note").textContent = t("dialog_secret");
    $("#secret-note").hidden = cfg.indexOf("<YOUR_KEY>") === -1;
  }

  var lastFocus = null;
  function openDialog() {
    lastFocus = document.activeElement;
    renderDialog();
    var d = $("#dlg");
    if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
    d.focus();
  }
  function closeDialog() {
    var d = $("#dlg");
    if (typeof d.close === "function") d.close(); else d.removeAttribute("open");
    var back = lastFocus;
    if (!back || !document.contains(back) || back.offsetParent === null) back = $("#cta-config");
    if (back && back.focus) setTimeout(function () { back.focus(); }, 0);
  }

  /* ---------- clipboard + download ---------- */
  function copyText(txt, okMsg) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = txt;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); toast(okMsg); } catch (e) { toast(txt.slice(0, 90)); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && window.isSecureContext) {
      var settled = false;
      var guard = setTimeout(function () { if (!settled) fallback(); }, 700);
      navigator.clipboard.writeText(txt).then(
        function () { settled = true; clearTimeout(guard); toast(okMsg); },
        function () { settled = true; clearTimeout(guard); fallback(); }
      );
    } else fallback();
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $("#toast");
    el.textContent = msg;
    el.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("on"); }, 1800);

    var st = $("#dlg-status");
    if (st) {
      st.textContent = msg;
      clearTimeout(st._t);
      st._t = setTimeout(function () { st.textContent = ""; }, 1800);
    }
  }

  function download(name, text) {
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
    toast(t("toast_downloaded"));
  }

  /* ---------- language & theme ---------- */
  function applyLang(lang) {
    state.lang = lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";

    var set = function (sel, key) { $$(sel).forEach(function (el) { el.textContent = t(key); }); };
    document.title = state.lang === "fa"
      ? "بازارچهٔ آزاد MCP — ۷۲ سرور، ۸۹۶ ابزار، بدون حساب"
      : "Open MCP Bazaar — 72 servers, 896 tools, no account";
    $("#brand-name").textContent = t("brand");
    $("#brand-sub").textContent = t("brand_sub");
    $("#skip").textContent = t("skip");
    $("#nav-catalog").textContent = t("nav_catalog");
    $("#nav-how").textContent = t("nav_how");
    $("#nav-compare").textContent = t("nav_compare");
    $("#search-input").placeholder = t("search_ph");
    $("#search-input").setAttribute("aria-label", t("search_label"));
    $("#lang-btn").textContent = t("lang");
    $("#lang-btn").setAttribute("lang", state.lang === "fa" ? "en" : "fa");
    $("#lang-btn").setAttribute("dir", state.lang === "fa" ? "ltr" : "rtl");
    $("#theme-btn").setAttribute("aria-label", t("theme"));
    $("#theme-btn").title = t("theme");
    $("#eyebrow-text").textContent = t("hero_eyebrow");
    $("#hero-h1").textContent = t("hero_h1");
    $("#hero-sub").textContent = t("hero_sub");
    $("#cta-browse").textContent = t("cta_browse");
    $("#cta-config").textContent = t("cta_config");
    $("#console-label").textContent = t("console_label");
    $("#console-ok").textContent = t("console_ok");
    $("#console-ask").textContent = t("console_ask");
    $("#stat-servers").textContent = t("stat_servers");
    $("#stat-tools").textContent = t("stat_tools");
    $("#stat-cats").textContent = t("stat_cats");
    $("#stat-net").textContent = t("stat_network");
    $("#catalog-title").textContent = t("catalog_title");
    $("#catalog-sub").textContent = t("catalog_sub");
    $("#sort-label").textContent = t("sort_label");
    var mac = /Mac|iPhone|iPad/.test(navigator.platform || "");
    $("#kbd-hint").textContent = mac ? "⌘K" : "Ctrl K";
    $("#n-servers").textContent = faNum(DATA.meta.servers);
    $("#n-tools").textContent = faNum(DATA.meta.tools);
    $("#n-groups").textContent = faNum(DATA.meta.groups);
    $("#n-net").textContent = faNum(0);
    $("#footer-date").textContent = state.lang === "fa" ? DATA.meta.date_fa : DATA.meta.date_en;
    var sel = $("#sort");
    sel.options[0].textContent = t("sort_default");
    sel.options[1].textContent = t("sort_tools");
    sel.options[2].textContent = t("sort_name");
    $("#how-title").textContent = t("how_title");
    $("#how-sub").textContent = t("how_sub");
    $("#how-1t").textContent = t("how_1_t");
    $("#how-1b").textContent = t("how_1_b");
    $("#how-2t").textContent = t("how_2_t");
    $("#how-2b").textContent = t("how_2_b");
    $("#how-3t").textContent = t("how_3_t");
    $("#how-3b").textContent = t("how_3_b");
    $("#cmp-title").textContent = t("compare_title");
    $("#cmp-sub").textContent = t("compare_sub");
    $("#cmp-free-col").textContent = t("compare_col_free");
    $("#cmp-hosted-col").textContent = t("compare_col_hosted");
    for (var i = 1; i <= 5; i++) {
      $("#cmp-r" + i).textContent = t("compare_r" + i);
      $("#cmp-r" + i + "-free").textContent = t("compare_r" + i + "_free");
      $("#cmp-r" + i + "-hosted").textContent = t("compare_r" + i + "_hosted");
    }
    $("#footer-note").textContent = t("footer_note");
    $("#footer-data").textContent = t("footer_data");
    $("#footer-built").textContent = t("footer_built");
    $("#footer-scope").textContent = t("footer_scope");
    $("#dlg-title").textContent = t("dialog_title");
    $("#dlg-sub").textContent = t("dialog_sub");
    $("#dlg-client-lbl").textContent = t("dialog_client");
    $("#dlg-close").setAttribute("aria-label", t("dialog_close"));
    $("#dlg-empty").textContent = t("dialog_empty");
    $("#secret-note").textContent = t("dialog_secret");

    try { localStorage.setItem("mcpfarsi.lang", lang); } catch (e) {}
    render();
    if ($("#dlg").open) renderDialog();
  }

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    $("#theme-btn").innerHTML = theme === "dark" ? ICON.moon : ICON.sun;
    try { localStorage.setItem("mcpfarsi.theme", theme); } catch (e) {}
  }

  /* ---------- events ---------- */
  function bind() {
    var search = $("#search-input");
    search.addEventListener("input", function () {
      state.q = search.value;
      render();
    });
    $("#search-form").addEventListener("submit", function (e) { e.preventDefault(); });

    $("#chips").addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      state.group = chip.getAttribute("data-group");
      render();
    });

    $("#sort").addEventListener("change", function (e) {
      state.sort = e.target.value;
      render();
    });

    gridEl.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      var card = e.target.closest(".card");
      if (!card) return;
      var name = card.getAttribute("data-name");
      var srv = SERVERS.filter(function (s) { return s.name === name; })[0];
      if (!srv) return;

      if (!btn) return;
      var act = btn.getAttribute("data-act");

      if (act === "tools") {
        var tb = card.querySelector(".toolbox");
        var open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        btn.innerHTML = (!open ? t("tools_hide") : fmt(t("tools_btn"), { n: faNum(srv.tool_count) })) + " " + ICON.chev;
        if (tb) tb.hidden = open;
        if (open) state.expanded.delete(name); else state.expanded.add(name);
      }

      if (act === "copy") {
        copyText(srv.url || srv.run, t("toast_copied"));
      }

      if (act === "pick") {
        if (state.picked.has(name)) state.picked.delete(name); else state.picked.add(name);
        try { localStorage.setItem("mcpfarsi.picked", JSON.stringify(Array.from(state.picked))); } catch (err) {}
        var now = state.picked.has(name);
        btn.setAttribute("aria-pressed", String(now));
        btn.classList.toggle("on", now);
        btn.textContent = now ? t("added_btn") : t("add_btn");
        card.classList.toggle("is-picked", now);
        updateDock();
        if ($("#dlg").open) renderDialog();
      }
    });

    $("#dock-build").addEventListener("click", openDialog);
    $("#dock-clear").addEventListener("click", function () {
      state.picked.clear();
      try { localStorage.removeItem("mcpfarsi.picked"); } catch (e) {}
      render();
    });
    $("#cta-config").addEventListener("click", openDialog);
    $("#empty-clear").addEventListener("click", function () {
      state.q = "";
      state.group = "all";
      $("#search-input").value = "";
      render();
      $("#search-input").focus();
    });

    $("#dlg-close").addEventListener("click", closeDialog);
    $("#dlg").addEventListener("click", function (e) {
      if (e.target === $("#dlg")) closeDialog();
    });
    $("#tabs").addEventListener("click", function (e) {
      var tab = e.target.closest(".tab");
      if (!tab) return;
      activeClient = tab.getAttribute("data-client");
      renderDialog();
    });
    $("#dlg-copy").addEventListener("click", function () { copyText(buildConfig(), t("toast_copied")); });
    $("#dlg-dl").addEventListener("click", function () {
      var c = CLIENTS.filter(function (x) { return x.id === activeClient; })[0];
      download(c.file, buildConfig());
    });

    $("#lang-btn").addEventListener("click", function () {
      applyLang(state.lang === "fa" ? "en" : "fa");
    });
    $("#theme-btn").addEventListener("click", function () {
      applyTheme(state.theme === "dark" ? "light" : "dark");
    });

    document.addEventListener("keydown", function (e) {
      var k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "k") {
        e.preventDefault();
        $("#search-input").focus();
        $("#search-input").select();
      } else if (e.key === "Escape" && document.activeElement === $("#search-input")) {
        $("#search-input").value = "";
        state.q = "";
        render();
      } else if (e.key === "/" && document.activeElement !== $("#search-input") &&
                 !/^(input|textarea|select)$/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        $("#search-input").focus();
      }
    });
  }

  /* ---------- init ---------- */
  function init() {
    var savedTheme = null, savedLang = null, savedPick = null;
    try {
      savedTheme = localStorage.getItem("mcpfarsi.theme");
      savedLang = localStorage.getItem("mcpfarsi.lang");
      savedPick = JSON.parse(localStorage.getItem("mcpfarsi.picked") || "null");
    } catch (e) {}

    if (Array.isArray(savedPick)) {
      savedPick.forEach(function (n) {
        if (SERVERS.some(function (s) { return s.name === n; })) state.picked.add(n);
      });
    }
    applyTheme(savedTheme === "light" ? "light" : "dark");
    bind();
    applyLang(savedLang === "en" ? "en" : "fa");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
