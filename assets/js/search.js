/* Site search: header button + Cmd/Ctrl+K. Indexes content.json sections and search.json pages. */
(function () {
  "use strict";

  var SECTIONS = ["experience", "education", "projects", "publications", "achievements"];
  var PAGE_OF = { publications: "/research/" };
  var CV_SECTIONS = ["experience", "education", "projects", "achievements", "patents", "skills"];
  var index = null;
  var loading = null;
  var modal, input, results, lastFocus, active = 0, hits = [];

  function pick(v) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      var lang = document.documentElement.getAttribute("data-content-lang") || "en";
      return v[lang] || v.en || "";
    }
    return typeof v === "string" ? v : "";
  }

  function flatten(v, out) {
    if (typeof v === "string") { out.push(v); }
    else if (Array.isArray(v)) { v.forEach(function (x) { flatten(x, out); }); }
    else if (v && typeof v === "object") { Object.keys(v).forEach(function (k) { flatten(v[k], out); }); }
    return out;
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) { throw new Error(url + " " + r.status); }
      return r.json();
    }).catch(function () { return null; });
  }

  function load() {
    if (index) { return Promise.resolve(index); }
    if (loading) { return loading; }
    var base = document.getElementById("site-search").getAttribute("data-base");
    loading = Promise.all([
      fetchJson(base + "/assets/json/content.json"),
      fetchJson(base + "/assets/json/search.json")
    ]).then(function (r) {
      var items = [];
      var content = r[0];
      if (content) {
        SECTIONS.forEach(function (s) {
          (content[s] || []).forEach(function (it) {
            var title = pick(it.title) || pick(it.role) || it.organization || it.institution || it.id;
            var sub = pick(it.role) && it.organization ? it.organization : (it.venue || it.degree || "");
            items.push({
              title: title, sub: s + (sub ? " · " + sub : ""),
              url: base + (PAGE_OF[s] || (CV_SECTIONS.indexOf(s) !== -1 ? "/cv/" : "/")) + "#section-" + (s === "achievements" && /^patent-/.test(it.id) ? "patents" : s),
              text: flatten(it, []).join(" ")
            });
          });
        });
        if (content.skills) {
          items.push({ title: "Skills", sub: "skills", url: base + "/cv/#section-skills",
                       text: flatten(content.skills, []).join(" ") });
        }
      }
      (r[1] || []).forEach(function (p) {
        items.push({ title: p.title, sub: "page", url: p.url, text: p.text || "" });
      });
      items.forEach(function (it) { it.hay = (it.title + " " + it.sub + " " + it.text).toLowerCase(); });
      index = items;
      return items;
    });
    return loading;
  }

  function search(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length || !index) { return []; }
    return index.map(function (it) {
      var score = 0;
      for (var i = 0; i < terms.length; i++) {
        if (it.hay.indexOf(terms[i]) === -1) { return null; }
        score += it.title.toLowerCase().indexOf(terms[i]) !== -1 ? 10 : 1;
      }
      return { it: it, score: score };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score; })
      .slice(0, 12).map(function (x) { return x.it; });
  }

  function snippet(it, q) {
    var t = it.text.replace(/\s+/g, " ");
    var term = q.toLowerCase().split(/\s+/)[0];
    var i = t.toLowerCase().indexOf(term);
    if (i < 0) { return t.slice(0, 120); }
    var s = Math.max(0, i - 40);
    return (s ? "…" : "") + t.slice(s, s + 140);
  }

  function render() {
    var q = input.value.trim();
    results.textContent = "";
    hits = search(q);
    active = 0;
    if (!q) { return; }
    if (!hits.length) {
      var empty = document.createElement("div");
      empty.className = "site-search-empty";
      empty.textContent = "No results";
      results.appendChild(empty);
      return;
    }
    hits.forEach(function (it, i) {
      var a = document.createElement("a");
      a.href = it.url;
      a.className = "site-search-hit" + (i === 0 ? " active" : "");
      var t = document.createElement("div"); t.className = "site-search-title"; t.textContent = it.title;
      var s = document.createElement("div"); s.className = "site-search-sub"; s.textContent = it.sub;
      var x = document.createElement("div"); x.className = "site-search-snippet"; x.textContent = snippet(it, q);
      a.appendChild(t); a.appendChild(s); a.appendChild(x);
      a.addEventListener("click", close);
      results.appendChild(a);
    });
  }

  function setActive(n) {
    var els = results.querySelectorAll(".site-search-hit");
    if (!els.length) { return; }
    active = (n + els.length) % els.length;
    for (var i = 0; i < els.length; i++) { els[i].classList.toggle("active", i === active); }
    els[active].scrollIntoView({ block: "nearest" });
  }

  function open() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("site-search-open");
    input.focus();
    input.select();
    load().then(render);
  }

  function close() {
    modal.hidden = true;
    document.body.classList.remove("site-search-open");
    if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
  }

  function init() {
    modal = document.getElementById("site-search");
    if (!modal) { return; }
    input = document.getElementById("site-search-input");
    results = document.getElementById("site-search-results");

    document.querySelectorAll("[data-search-open]").forEach(function (b) { b.addEventListener("click", open); });
    modal.addEventListener("mousedown", function (e) { if (e.target === modal) { close(); } });
    input.addEventListener("input", render);
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
      else if (e.key === "Enter") {
        var el = results.querySelectorAll(".site-search-hit")[active];
        if (el) { e.preventDefault(); el.click(); window.location.href = el.href; }
      }
    });
    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (modal.hidden) { open(); } else { close(); }
      } else if (e.key === "Escape" && !modal.hidden) {
        close();
      }
    });
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); }
  else { init(); }
})();
