/**
 * content-loader.js
 * -----------------------------------------------------------------------------
 * Client-side loader/renderer for the public content contract published by the
 * separate `personal-os` repository to /assets/json/content.json.
 *
 * This file is the ONLY runtime source of the professional facts shown on the
 * homepage. It does not maintain a second copy of those facts: it fetches the
 * JSON contract, validates its basic shape, selects a language, and renders the
 * sections into the page using safe DOM APIs (textContent / createElement — no
 * unsanitized innerHTML).
 *
 * The pure helpers (validation, language selection, formatting, URL safety,
 * markdown-to-DOM) are exported for Node-based unit tests via module.exports.
 * The browser bootstrap only runs when a `document` is present.
 *
 * Written in conservative ES5 so the jekyll-minifier (uglifier) build step
 * cannot choke on newer syntax.
 * -----------------------------------------------------------------------------
 */
(function (root) {
  "use strict";

  var SUPPORTED_SCHEMA_VERSION = "1";
  var DEFAULT_LANG = "en";
  var SUPPORTED_LANGS = ["en", "ru"];
  var STORAGE_KEY = "site-content-lang";
  var DEFAULT_CONTENT_URL = "/assets/json/content.json";

  var REQUIRED_ARRAYS = [
    "experience",
    "education",
    "projects",
    "publications",
    "achievements"
  ];

  // UI chrome strings (headings, states). These are presentation labels, not
  // professional facts, so they legitimately live in the frontend.
  var UI = {
    en: {
      loading: "Loading content…",
      errorTitle: "Unable to load website content.",
      errorBody: "Please try again later.",
      retry: "Retry",
      present: "Present",
      sections: {
        profile: "About",
        experience: "Experience",
        education: "Education",
        projects: "Projects",
        publications: "Publications",
        achievements: "Achievements",
        patents: "Patents",
        skills: "Skills",
        links: "Links",
        blog: "Blog"
      },
      interests: "Interests",
      thesis: "Thesis",
      gpa: "GPA",
      technologies: "Technologies",
      metrics: "Key results",
      authors: "Authors",
      venue: "Venue",
      details: "Details",
      blogEmpty: "No posts yet.",
      status: {
        current: "Current",
        active: "Active",
        completed: "Completed",
        published: "Published",
        under_review: "Under review",
        in_progress: "In progress"
      }
    },
    ru: {
      loading: "Загрузка контента…",
      errorTitle: "Не удалось загрузить содержимое сайта.",
      errorBody: "Пожалуйста, попробуйте позже.",
      retry: "Повторить",
      present: "Настоящее время",
      sections: {
        profile: "Обо мне",
        experience: "Опыт",
        education: "Образование",
        projects: "Проекты",
        publications: "Публикации",
        achievements: "Достижения",
        patents: "Патенты",
        skills: "Навыки",
        links: "Ссылки",
        blog: "Блог"
      },
      interests: "Интересы",
      thesis: "Тема работы",
      gpa: "Средний балл",
      technologies: "Технологии",
      metrics: "Ключевые результаты",
      authors: "Авторы",
      venue: "Издание",
      details: "Подробнее",
      blogEmpty: "Пока нет записей.",
      status: {
        current: "Текущий",
        active: "Активный",
        completed: "Завершён",
        published: "Опубликовано",
        under_review: "На рецензировании",
        in_progress: "В работе"
      }
    }
  };

  var MONTHS = {
    en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    ru: ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]
  };

  // ---------------------------------------------------------------------------
  // Pure helpers (unit-testable, no DOM required)
  // ---------------------------------------------------------------------------

  function isObject(v) {
    return v !== null && typeof v === "object" && !isArray(v);
  }

  function isArray(v) {
    return Object.prototype.toString.call(v) === "[object Array]";
  }

  function ui(lang) {
    return UI[normalizeLang(lang)];
  }

  /**
   * Lightweight defensive validation of the content contract. Mirrors the
   * minimal checks required by the frontend spec; the canonical strict schema
   * is owned by personal-os, not reproduced here.
   * Returns the data on success, throws Error otherwise.
   */
  function validateContent(data) {
    if (!isObject(data)) {
      throw new Error("Content root is not an object");
    }
    if (typeof data.schema_version === "undefined") {
      throw new Error("Missing schema_version");
    }
    if (data.schema_version !== SUPPORTED_SCHEMA_VERSION) {
      throw new Error("Unsupported content schema version: " + data.schema_version);
    }
    if (!isObject(data.profile)) {
      throw new Error("Missing or invalid profile");
    }
    for (var i = 0; i < REQUIRED_ARRAYS.length; i++) {
      var key = REQUIRED_ARRAYS[i];
      if (!isArray(data[key])) {
        throw new Error("Field '" + key + "' must be an array");
      }
    }
    if (!isObject(data.skills)) {
      throw new Error("Missing or invalid skills");
    }
    if (!isObject(data.links)) {
      throw new Error("Missing or invalid links");
    }
    return data;
  }

  function normalizeLang(lang) {
    return SUPPORTED_LANGS.indexOf(lang) !== -1 ? lang : DEFAULT_LANG;
  }

  /**
   * Resolve a possibly-localized scalar. Accepts a plain string or a
   * {en, ru} map. Returns the requested language value, or null when the
   * requested localization is missing/null. We deliberately do NOT fall back
   * to another language: missing localization is surfaced as absence, never as
   * an invented translation.
   */
  function localized(value, lang) {
    if (value === null || typeof value === "undefined") {
      return null;
    }
    if (typeof value === "string") {
      return value;
    }
    if (isObject(value)) {
      var v = value[normalizeLang(lang)];
      return (v === null || typeof v === "undefined") ? null : v;
    }
    return null;
  }

  /**
   * Resolve a possibly-localized list. Accepts a plain array or a
   * {en:[], ru:[]} map. Returns [] when absent/null for the requested language.
   */
  function localizedList(value, lang) {
    if (isArray(value)) {
      return value;
    }
    if (isObject(value)) {
      var v = value[normalizeLang(lang)];
      return isArray(v) ? v : [];
    }
    return [];
  }

  /** "2025-08" -> "Aug 2025" (localized short month). Returns "" for falsy. */
  function formatMonth(ym, lang) {
    if (!ym || typeof ym !== "string") {
      return "";
    }
    var parts = ym.split("-");
    var year = parts[0];
    var month = parseInt(parts[1], 10);
    if (!year) {
      return "";
    }
    if (month >= 1 && month <= 12) {
      return MONTHS[normalizeLang(lang)][month - 1] + " " + year;
    }
    return year;
  }

  /**
   * Format a {start, end} period. When end is null and status marks the item as
   * ongoing, render the localized "Present" token rather than inventing a date.
   */
  function formatPeriod(period, status, lang) {
    if (!isObject(period)) {
      return "";
    }
    var start = formatMonth(period.start, lang);
    var ongoing = (period.end === null || typeof period.end === "undefined") &&
      (status === "current" || status === "active" || status === "in_progress");
    var end = period.end ? formatMonth(period.end, lang) : (ongoing ? ui(lang).present : "");
    if (start && end) {
      return start + " – " + end;
    }
    return start || end || "";
  }

  function statusLabel(status, lang) {
    if (!status) {
      return "";
    }
    var map = ui(lang).status;
    return map[status] || status;
  }

  /**
   * Only http(s) and mailto URLs are considered safe to insert. Everything else
   * (javascript:, data:, vbscript:, relative injections, etc.) is rejected.
   */
  function isSafeUrl(url) {
    if (typeof url !== "string") {
      return false;
    }
    return /^(https?:|mailto:)/i.test(url.trim());
  }

  /** Patent records use the `patent-*` id convention from the data generator. */
  function isPatent(achievement) {
    return !!achievement &&
      typeof achievement.id === "string" &&
      achievement.id.indexOf("patent-") === 0;
  }

  function formatMetric(metric) {
    if (!isObject(metric)) {
      return "";
    }
    var value = metric.value;
    if (value === null || typeof value === "undefined") {
      value = "";
    }
    var out = String(value);
    if (metric.unit) {
      out += (out ? " " : "") + metric.unit;
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Safe markdown -> DOM (no innerHTML anywhere)
  // ---------------------------------------------------------------------------

  var INLINE_RE = /(\[([^\]]+)\]\(([^)\s]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g;

  /**
   * Append inline markdown (links, bold, italic, code) to `parent` as DOM
   * nodes. Text is inserted via text nodes and element.textContent only, and
   * link URLs are validated, so hostile strings such as
   * "<script>alert(1)</script>" or "[x](javascript:alert(1))" cannot execute.
   * When document is unavailable (Node tests), returns escaped plain text.
   */
  function appendInline(parent, text, doc) {
    if (!doc) {
      return;
    }
    text = String(text);
    INLINE_RE.lastIndex = 0;
    var lastIndex = 0;
    var m;
    while ((m = INLINE_RE.exec(text)) !== null) {
      if (m.index > lastIndex) {
        parent.appendChild(doc.createTextNode(text.slice(lastIndex, m.index)));
      }
      if (m[1]) {
        var url = m[3];
        var label = m[2];
        if (isSafeUrl(url)) {
          var a = doc.createElement("a");
          a.href = url;
          a.textContent = label;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          parent.appendChild(a);
        } else {
          parent.appendChild(doc.createTextNode(label));
        }
      } else if (m[4]) {
        appendTextEl(parent, doc, "strong", m[5]);
      } else if (m[6]) {
        appendTextEl(parent, doc, "em", m[7]);
      } else if (m[8]) {
        appendTextEl(parent, doc, "code", m[9]);
      }
      lastIndex = INLINE_RE.lastIndex;
    }
    if (lastIndex < text.length) {
      parent.appendChild(doc.createTextNode(text.slice(lastIndex)));
    }
  }

  function appendTextEl(parent, doc, tag, text) {
    var e = doc.createElement(tag);
    e.textContent = text;
    parent.appendChild(e);
  }

  /**
   * Render a block of markdown into `container` using a safe subset:
   * headings, paragraphs, unordered lists, and the inline rules above.
   */
  function renderMarkdownInto(container, md, doc) {
    if (!doc || md === null || typeof md === "undefined") {
      return;
    }
    var lines = String(md).split(/\r?\n/);
    var list = null;
    function flush() {
      if (list) {
        container.appendChild(list);
        list = null;
      }
    }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/\s+$/, "");
      if (/^\s*$/.test(line)) {
        flush();
        continue;
      }
      var heading = /^(#{1,6})\s+(.*)$/.exec(line);
      if (heading) {
        flush();
        var level = Math.min(heading[1].length + 2, 6);
        var h = doc.createElement("h" + level);
        appendInline(h, heading[2], doc);
        container.appendChild(h);
        continue;
      }
      var item = /^\s*[-*]\s+(.*)$/.exec(line);
      if (item) {
        if (!list) {
          list = doc.createElement("ul");
        }
        var li = doc.createElement("li");
        appendInline(li, item[1], doc);
        list.appendChild(li);
        continue;
      }
      flush();
      var p = doc.createElement("p");
      appendInline(p, line, doc);
      container.appendChild(p);
    }
    flush();
  }

  // ---------------------------------------------------------------------------
  // DOM utilities
  // ---------------------------------------------------------------------------

  function el(doc, tag, className, text) {
    var node = doc.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (typeof text !== "undefined" && text !== null) {
      node.textContent = text;
    }
    return node;
  }

  function section(doc, id, title) {
    var wrap = el(doc, "section", "dyn-section");
    wrap.id = "section-" + id;
    if (title) {
      wrap.appendChild(el(doc, "h2", "dyn-section-title", title));
    }
    return wrap;
  }

  function chip(doc, text) {
    return el(doc, "span", "dyn-chip", text);
  }

  function safeLink(doc, url, label) {
    if (!isSafeUrl(url)) {
      return el(doc, "span", "dyn-link-disabled", label || url);
    }
    var a = el(doc, "a", "dyn-link", label || url);
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }

  /** Flatten the nested links object into a list of {url, label}. */
  function flattenLinks(links) {
    var out = [];
    function walk(node, fallbackLabel) {
      if (!node) {
        return;
      }
      if (typeof node === "string") {
        // e.g. links.email
        if (fallbackLabel === "email") {
          out.push({ url: "mailto:" + node, label: "Email" });
        }
        return;
      }
      if (isObject(node) && typeof node.url === "string") {
        out.push({ url: node.url, label: node.label || node.url });
        return;
      }
      if (isObject(node)) {
        for (var k in node) {
          if (Object.prototype.hasOwnProperty.call(node, k)) {
            walk(node[k], k);
          }
        }
      }
    }
    walk(links, null);
    return out;
  }

  // ---------------------------------------------------------------------------
  // Section renderers
  // ---------------------------------------------------------------------------

  function renderProfile(doc, data, lang) {
    var t = ui(lang);
    var p = data.profile;
    // The profile opens the page, so it has no "About" heading or divider.
    var wrap = section(doc, "profile", null);

    var headline = localized(p.headline, lang);
    if (headline) {
      wrap.appendChild(el(doc, "p", "dyn-headline", headline));
    }
    var summary = localized(p.summary, lang);
    if (summary) {
      var lines = String(summary).split(/\n+/);
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].trim()) {
          wrap.appendChild(el(doc, "p", "dyn-summary", lines[i].trim()));
        }
      }
    }
    if (p.location) {
      var loc = el(doc, "p", "dyn-location");
      loc.appendChild(el(doc, "i", "fas fa-map-marker-alt"));
      loc.appendChild(doc.createTextNode(" " + p.location));
      wrap.appendChild(loc);
    }
    if (isArray(p.interests) && p.interests.length) {
      wrap.appendChild(el(doc, "h3", "dyn-subheading", t.interests));
      var chips = el(doc, "div", "dyn-chips");
      for (var j = 0; j < p.interests.length; j++) {
        chips.appendChild(chip(doc, p.interests[j]));
      }
      wrap.appendChild(chips);
    }
    return wrap;
  }

  function renderStatusBadge(doc, status, lang) {
    var label = statusLabel(status, lang);
    if (!label) {
      return null;
    }
    return el(doc, "span", "dyn-badge dyn-badge-" + status, label);
  }

  /**
   * Reverse-chronological by period: ongoing items (no end) first, then by end
   * date, then by start date. Ties keep their published order.
   */
  function sortByPeriod(list) {
    function key(v, fallback) { return typeof v === "string" && v ? v : fallback; }
    return list.map(function (item, index) { return { item: item, index: index }; })
      .sort(function (a, b) {
        var pa = isObject(a.item.period) ? a.item.period : {};
        var pb = isObject(b.item.period) ? b.item.period : {};
        var ea = key(pa.end, "9999-99"), eb = key(pb.end, "9999-99");
        if (ea !== eb) { return ea < eb ? 1 : -1; }
        var sa = key(pa.start, ""), sb = key(pb.start, "");
        if (sa !== sb) { return sa < sb ? 1 : -1; }
        return a.index - b.index;
      })
      .map(function (x) { return x.item; });
  }

  function renderExperience(doc, data, lang) {
    var t = ui(lang);
    var wrap = section(doc, "experience", t.sections.experience);
    var list = el(doc, "div", "dyn-timeline");
    var jobs = sortByPeriod(data.experience);
    for (var i = 0; i < jobs.length; i++) {
      var item = jobs[i];
      var card = el(doc, "div", "dyn-card dyn-timeline-item");

      var header = el(doc, "div", "dyn-card-header");
      var role = localized(item.role, lang);
      header.appendChild(el(doc, "h3", "dyn-card-title", role || item.organization));
      var badge = renderStatusBadge(doc, item.status, lang);
      if (badge) {
        header.appendChild(badge);
      }
      card.appendChild(header);

      var meta = el(doc, "div", "dyn-card-meta");
      var orgLink = item.links && item.links.organization;
      if (orgLink && orgLink.url) {
        meta.appendChild(safeLink(doc, orgLink.url, item.organization));
      } else {
        meta.appendChild(el(doc, "span", "dyn-org", item.organization));
      }
      var period = formatPeriod(item.period, item.status, lang);
      if (period) {
        meta.appendChild(el(doc, "span", "dyn-period", period));
      }
      if (item.location) {
        meta.appendChild(el(doc, "span", "dyn-loc", item.location));
      }
      card.appendChild(meta);

      var resp = localizedList(item.responsibilities, lang);
      if (resp.length) {
        var ul = el(doc, "ul", "dyn-list");
        for (var r = 0; r < resp.length; r++) {
          ul.appendChild(el(doc, "li", null, resp[r]));
        }
        card.appendChild(ul);
      }
      list.appendChild(card);
    }
    wrap.appendChild(list);
    return wrap;
  }

  function renderEducation(doc, data, lang) {
    var t = ui(lang);
    var wrap = section(doc, "education", t.sections.education);
    for (var i = 0; i < data.education.length; i++) {
      var item = data.education[i];
      var card = el(doc, "div", "dyn-card");

      var degree = localized(item.degree, lang);
      var field = localized(item.field, lang);
      var titleText = [degree, field].filter(Boolean).join(", ");
      card.appendChild(el(doc, "h3", "dyn-card-title", titleText || localized(item.institution, lang)));

      var meta = el(doc, "div", "dyn-card-meta");
      meta.appendChild(el(doc, "span", "dyn-org", localized(item.institution, lang)));
      var period = formatPeriod(item.period, item.status, lang);
      if (period) {
        meta.appendChild(el(doc, "span", "dyn-period", period));
      }
      card.appendChild(meta);

      if (isArray(item.gpa) && item.gpa.length) {
        var gpaParts = [];
        for (var g = 0; g < item.gpa.length; g++) {
          var gp = item.gpa[g];
          // Preserve each scale exactly as published; never convert between scales.
          gpaParts.push(gp.value + " / " + gp.scale);
        }
        card.appendChild(el(doc, "p", "dyn-gpa", t.gpa + ": " + gpaParts.join("  ·  ")));
      }
      var thesis = localized(item.thesis, lang);
      if (thesis) {
        var th = el(doc, "p", "dyn-thesis");
        th.appendChild(el(doc, "strong", null, t.thesis + ": "));
        th.appendChild(doc.createTextNode(thesis));
        card.appendChild(th);
      }
      wrap.appendChild(card);
    }
    return wrap;
  }

  function renderMetricsGrid(doc, metrics, lang) {
    if (!isArray(metrics) || !metrics.length) {
      return null;
    }
    var grid = el(doc, "div", "dyn-metrics");
    for (var i = 0; i < metrics.length; i++) {
      var m = metrics[i];
      var cell = el(doc, "div", "dyn-metric");
      cell.appendChild(el(doc, "span", "dyn-metric-value", formatMetric(m)));
      if (m.name) {
        cell.appendChild(el(doc, "span", "dyn-metric-name", m.name));
      }
      // dataset/model/unit may be null or absent — only render what exists.
      if (m.dataset) {
        cell.appendChild(el(doc, "span", "dyn-metric-sub", m.dataset));
      }
      grid.appendChild(cell);
    }
    return grid;
  }

  function renderProjects(doc, data, lang) {
    var t = ui(lang);
    var wrap = section(doc, "projects", t.sections.projects);
    var grid = el(doc, "div", "dyn-grid");
    for (var i = 0; i < data.projects.length; i++) {
      var item = data.projects[i];
      var card = el(doc, "div", "dyn-card dyn-project");

      var header = el(doc, "div", "dyn-card-header");
      header.appendChild(el(doc, "h3", "dyn-card-title", localized(item.title, lang) || item.id));
      var badge = renderStatusBadge(doc, item.status, lang);
      if (badge) {
        header.appendChild(badge);
      }
      card.appendChild(header);

      var period = formatPeriod(item.period, item.status, lang);
      if (period) {
        card.appendChild(el(doc, "div", "dyn-card-meta", period));
      }

      var highlights = localizedList(item.highlights, lang);
      if (highlights.length) {
        var ul = el(doc, "ul", "dyn-list");
        for (var h = 0; h < highlights.length; h++) {
          ul.appendChild(el(doc, "li", null, highlights[h]));
        }
        card.appendChild(ul);
      }

      var metrics = renderMetricsGrid(doc, item.metrics, lang);
      if (metrics) {
        card.appendChild(el(doc, "h4", "dyn-mini-heading", t.metrics));
        card.appendChild(metrics);
      }

      if (isArray(item.technologies) && item.technologies.length) {
        var chips = el(doc, "div", "dyn-chips");
        for (var c = 0; c < item.technologies.length; c++) {
          chips.appendChild(chip(doc, item.technologies[c]));
        }
        card.appendChild(chips);
      }

      // Full markdown description behind a <details> to keep cards compact and
      // to render markdown safely (no raw markdown text, no innerHTML).
      var description = localized(item.description, lang);
      if (description) {
        var details = el(doc, "details", "dyn-details");
        details.appendChild(el(doc, "summary", null, t.details));
        var body = el(doc, "div", "dyn-markdown");
        renderMarkdownInto(body, description, doc);
        details.appendChild(body);
        card.appendChild(details);
      }

      var links = flattenLinks(item.links);
      if (links.length) {
        var linkRow = el(doc, "div", "dyn-links-row");
        for (var l = 0; l < links.length; l++) {
          linkRow.appendChild(safeLink(doc, links[l].url, links[l].label));
        }
        card.appendChild(linkRow);
      }
      grid.appendChild(card);
    }
    wrap.appendChild(grid);
    return wrap;
  }

  /** Newest first by year; ties (and missing years) keep their published order. */
  function sortPublicationsByYear(list) {
    return list.map(function (item, index) { return { item: item, index: index }; })
      .sort(function (a, b) {
        var ya = typeof a.item.year === "number" ? a.item.year : -Infinity;
        var yb = typeof b.item.year === "number" ? b.item.year : -Infinity;
        if (ya !== yb) { return yb > ya ? 1 : -1; }
        return a.index - b.index;
      })
      .map(function (x) { return x.item; });
  }

  function renderPublications(doc, data, lang) {
    var t = ui(lang);
    var wrap = section(doc, "publications", t.sections.publications);
    var pubs = sortPublicationsByYear(data.publications);
    for (var i = 0; i < pubs.length; i++) {
      var item = pubs[i];
      var card = el(doc, "div", "dyn-card dyn-publication");

      var header = el(doc, "div", "dyn-card-header");
      header.appendChild(el(doc, "h3", "dyn-card-title", localized(item.title, lang) || item.id));
      var badge = renderStatusBadge(doc, item.status, lang);
      if (badge) {
        header.appendChild(badge);
      }
      card.appendChild(header);

      if (isArray(item.authors) && item.authors.length) {
        card.appendChild(el(doc, "p", "dyn-authors", item.authors.join(", ")));
      }

      var venueLine = [];
      if (isObject(item.venue) && item.venue.name) {
        venueLine.push(item.venue.name);
      }
      if (item.year) {
        venueLine.push(String(item.year));
      }
      if (venueLine.length) {
        card.appendChild(el(doc, "p", "dyn-venue", venueLine.join(", ")));
      }

      var linkRow = el(doc, "div", "dyn-links-row");
      if (item.doi) {
        linkRow.appendChild(safeLink(doc, "https://doi.org/" + item.doi, "DOI"));
      }
      var links = flattenLinks(item.links);
      for (var l = 0; l < links.length; l++) {
        linkRow.appendChild(safeLink(doc, links[l].url, links[l].label));
      }
      if (linkRow.childNodes.length) {
        card.appendChild(linkRow);
      }
      wrap.appendChild(card);
    }
    return wrap;
  }

  function renderAchievementItem(doc, item, lang) {
    var card = el(doc, "div", "dyn-card dyn-achievement");
    var header = el(doc, "div", "dyn-card-header");
    header.appendChild(el(doc, "h3", "dyn-card-title", localized(item.title, lang) || item.id));
    if (item.date) {
      header.appendChild(el(doc, "span", "dyn-date", item.date));
    }
    card.appendChild(header);
    if (item.organization) {
      card.appendChild(el(doc, "p", "dyn-org", item.organization));
    }
    var result = localized(item.result, lang);
    if (result) {
      card.appendChild(el(doc, "p", "dyn-result", result));
    }
    if (isArray(item.links) && item.links.length) {
      var linkRow = el(doc, "div", "dyn-links-row");
      for (var l = 0; l < item.links.length; l++) {
        linkRow.appendChild(safeLink(doc, item.links[l].url, item.links[l].label));
      }
      card.appendChild(linkRow);
    }
    return card;
  }

  function renderAchievements(doc, data, lang) {
    var t = ui(lang);
    var wrap = section(doc, "achievements", t.sections.achievements);
    var patents = [];
    var others = [];
    for (var i = 0; i < data.achievements.length; i++) {
      (isPatent(data.achievements[i]) ? patents : others).push(data.achievements[i]);
    }
    for (var a = 0; a < others.length; a++) {
      wrap.appendChild(renderAchievementItem(doc, others[a], lang));
    }
    // Patents rendered as a visually distinct subsection, still sourced from
    // achievements[] — no separate patent model.
    if (patents.length) {
      wrap.appendChild(el(doc, "h3", "dyn-subheading", t.sections.patents));
      for (var p = 0; p < patents.length; p++) {
        wrap.appendChild(renderAchievementItem(doc, patents[p], lang));
      }
    }
    return wrap;
  }

  function renderSkills(doc, data, lang) {
    var t = ui(lang);
    var wrap = section(doc, "skills", t.sections.skills);
    var groups = (data.skills && isArray(data.skills.groups)) ? data.skills.groups : [];
    for (var i = 0; i < groups.length; i++) {
      var group = groups[i];
      if (!isArray(group.items) || !group.items.length) {
        continue; // gracefully skip empty groups
      }
      var block = el(doc, "div", "dyn-skill-group");
      // Category label: humanize the raw key generically (works for new keys).
      block.appendChild(el(doc, "h3", "dyn-subheading", humanize(group.category)));
      var chips = el(doc, "div", "dyn-chips");
      for (var s = 0; s < group.items.length; s++) {
        chips.appendChild(chip(doc, group.items[s]));
      }
      block.appendChild(chips);
      wrap.appendChild(block);
    }
    return wrap;
  }

  function humanize(key) {
    if (!key || typeof key !== "string") {
      return "";
    }
    return key.replace(/_/g, " ").replace(/\b\w/g, function (ch) {
      return ch.toUpperCase();
    });
  }

  function renderLinks(doc, data, lang) {
    var t = ui(lang);
    var wrap = section(doc, "links", t.sections.links);
    var links = flattenLinks(data.links);
    var row = el(doc, "div", "dyn-links-row");
    for (var i = 0; i < links.length; i++) {
      row.appendChild(safeLink(doc, links[i].url, links[i].label));
    }
    wrap.appendChild(row);
    return wrap;
  }

  function renderBlog(doc, data, lang) {
    var t = ui(lang);
    var wrap = section(doc, "blog", t.sections.blog);
    var posts = isArray(data.blog) ? data.blog : [];
    if (!posts.length) {
      wrap.appendChild(el(doc, "p", "dyn-empty", t.blogEmpty));
      return wrap;
    }
    for (var i = 0; i < posts.length; i++) {
      var post = posts[i];
      var card = el(doc, "div", "dyn-card");
      card.appendChild(el(doc, "h3", "dyn-card-title", localized(post.title, lang) || ""));
      if (post.date) {
        card.appendChild(el(doc, "span", "dyn-date", post.date));
      }
      var summary = localized(post.summary, lang);
      if (summary) {
        card.appendChild(el(doc, "p", null, summary));
      }
      if (post.url) {
        card.appendChild(safeLink(doc, post.url, localized(post.title, lang) || post.url));
      }
      wrap.appendChild(card);
    }
    return wrap;
  }

  /** Master render: builds all sections into a fresh fragment. */
  /**
   * `sections` (optional array of section ids) limits what is rendered; when
   * omitted every section is rendered. Pages choose theirs via data-sections.
   */
  function renderAll(doc, data, lang, sections) {
    lang = normalizeLang(lang);
    var frag = doc.createDocumentFragment();
    function want(id) { return !sections || sections.indexOf(id) !== -1; }
    if (want("profile")) { frag.appendChild(renderProfile(doc, data, lang)); }
    if (want("experience") && data.experience.length) { frag.appendChild(renderExperience(doc, data, lang)); }
    if (want("education") && data.education.length) { frag.appendChild(renderEducation(doc, data, lang)); }
    if (want("projects") && data.projects.length) { frag.appendChild(renderProjects(doc, data, lang)); }
    if (want("publications") && data.publications.length) { frag.appendChild(renderPublications(doc, data, lang)); }
    if (want("achievements") && data.achievements.length) { frag.appendChild(renderAchievements(doc, data, lang)); }
    if (want("skills")) { frag.appendChild(renderSkills(doc, data, lang)); }
    if (want("links")) { frag.appendChild(renderLinks(doc, data, lang)); }
    if (want("blog") && isArray(data.blog) && data.blog.length) {
      frag.appendChild(renderBlog(doc, data, lang));
    }
    return frag;
  }

  // ---------------------------------------------------------------------------
  // Fetch + browser bootstrap
  // ---------------------------------------------------------------------------

  /**
   * Fetch and validate the contract. `cache: "no-cache"` lets the browser keep
   * the file but revalidate it (conditional request) on each load, so a newly
   * published content.json appears without any HTML rebuild while avoiding an
   * aggressive no-store refetch.
   */
  function loadContent(url, fetchImpl) {
    var f = fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
    if (!f) {
      return Promise.reject(new Error("fetch is not available"));
    }
    return f(url, { cache: "no-cache", headers: { Accept: "application/json" } })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("HTTP " + response.status + " while loading content");
        }
        return response.text();
      })
      .then(function (text) {
        var data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error("Content is not valid JSON");
        }
        return validateContent(data);
      });
  }

  function chooseInitialLang(win) {
    try {
      var stored = win.localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED_LANGS.indexOf(stored) !== -1) {
        return stored;
      }
    } catch (e) { /* localStorage may be blocked */ }
    var nav = (win.navigator && win.navigator.language) ? win.navigator.language.toLowerCase() : "";
    return nav.indexOf("ru") === 0 ? "ru" : DEFAULT_LANG;
  }

  function bootstrap(win) {
    var doc = win.document;
    var root = doc.getElementById("dynamic-content");
    if (!root) {
      return;
    }
    var url = root.getAttribute("data-content-url") || DEFAULT_CONTENT_URL;
    var sectionAttr = root.getAttribute("data-sections");
    var sections = sectionAttr ? sectionAttr.split(",").map(function (x) { return x.trim(); }) : null;
    var loadingEl = doc.getElementById("site-loading");
    var errorEl = doc.getElementById("site-error");
    var contentEl = doc.getElementById("site-content");
    var lang = chooseInitialLang(win);
    var currentData = null;

    function setState(state) {
      if (loadingEl) { loadingEl.hidden = (state !== "loading"); }
      if (errorEl) { errorEl.hidden = (state !== "error"); }
      if (contentEl) { contentEl.hidden = (state !== "ready"); }
    }

    var scrolledToHash = false;

    function paint() {
      if (!currentData || !contentEl) {
        return;
      }
      while (contentEl.firstChild) {
        contentEl.removeChild(contentEl.firstChild);
      }
      contentEl.appendChild(renderAll(doc, currentData, lang, sections));
      doc.documentElement.setAttribute("data-content-lang", lang);
      updateLangButtons();
      if (!scrolledToHash && win.location && win.location.hash.length > 1) {
        scrolledToHash = true;
        var target = doc.getElementById(win.location.hash.slice(1));
        if (target && target.scrollIntoView) { target.scrollIntoView(); }
      }
    }

    function updateLangButtons() {
      var items = doc.querySelectorAll("[data-lang-item]");
      for (var i = 0; i < items.length; i++) { items[i].hidden = false; }
      var codes = doc.querySelectorAll("[data-lang-code]");
      for (var j = 0; j < codes.length; j++) { codes[j].textContent = lang.toUpperCase(); }
      var t = ui(lang);
      if (errorEl) {
        var title = errorEl.querySelector(".dyn-error-title");
        var body = errorEl.querySelector(".dyn-error-body");
        var retry = errorEl.querySelector(".dyn-retry");
        if (title) { title.textContent = t.errorTitle; }
        if (body) { body.textContent = t.errorBody; }
        if (retry) { retry.textContent = t.retry; }
      }
      if (loadingEl) {
        var lbl = loadingEl.querySelector(".dyn-loading-label");
        if (lbl) { lbl.textContent = t.loading; }
      }
    }

    function setLang(next) {
      lang = normalizeLang(next);
      try { win.localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
      paint();
    }

    function wireLangButtons() {
      var buttons = doc.querySelectorAll("[data-lang-toggle]");
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener("click", function () {
          setLang(lang === "en" ? "ru" : "en");
        });
      }
    }

    function load() {
      setState("loading");
      updateLangButtons();
      loadContent(url).then(function (data) {
        currentData = data;
        setState("ready");
        paint();
      })["catch"](function (err) {
        // Log a useful error for developers; visitors see a friendly message.
        if (win.console && win.console.error) {
          win.console.error("[content-loader] " + err.message);
        }
        setState("error");
        updateLangButtons();
      });
    }

    wireLangButtons();
    var retryBtn = errorEl ? errorEl.querySelector(".dyn-retry") : null;
    if (retryBtn) {
      retryBtn.addEventListener("click", load);
    }
    load();
  }

  // ---------------------------------------------------------------------------
  // Exports
  // ---------------------------------------------------------------------------

  var api = {
    SUPPORTED_SCHEMA_VERSION: SUPPORTED_SCHEMA_VERSION,
    SUPPORTED_LANGS: SUPPORTED_LANGS,
    validateContent: validateContent,
    normalizeLang: normalizeLang,
    localized: localized,
    localizedList: localizedList,
    formatMonth: formatMonth,
    formatPeriod: formatPeriod,
    statusLabel: statusLabel,
    isSafeUrl: isSafeUrl,
    isPatent: isPatent,
    formatMetric: formatMetric,
    flattenLinks: flattenLinks,
    renderMarkdownInto: renderMarkdownInto,
    appendInline: appendInline,
    renderAll: renderAll,
    loadContent: loadContent,
    bootstrap: bootstrap
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.SiteContent = api;

  if (typeof document !== "undefined" && typeof window !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        bootstrap(window);
      });
    } else {
      bootstrap(window);
    }
  }
})(typeof self !== "undefined" ? self : this);
