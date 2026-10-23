"use strict";

/**
 * Unit + regression tests for assets/js/content-loader.js.
 * Run with:  node --test
 * Uses only the Node built-in test runner + a tiny fake DOM (no dependencies).
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SC = require("../assets/js/content-loader.js");

// ---------------------------------------------------------------------------
// Minimal fake DOM sufficient for the pure DOM renderers (createElement /
// createTextNode / appendChild / textContent). Enough to assert structure and
// to prove hostile strings are inserted as text, never as live elements.
// ---------------------------------------------------------------------------
function makeNode(tag) {
  const node = {
    _tag: tag,
    tagName: tag ? tag.toUpperCase() : undefined,
    className: "",
    id: "",
    childNodes: [],
    attributes: {},
    _textContent: "",
    appendChild(child) { this.childNodes.push(child); return child; },
    setAttribute(k, v) { this.attributes[k] = v; },
    querySelector() { return null; }
  };
  Object.defineProperty(node, "textContent", {
    get() {
      if (this.childNodes.length) {
        return this.childNodes.map((c) => c.textContent).join("");
      }
      return this._textContent || "";
    },
    set(v) { this._textContent = v == null ? "" : String(v); this.childNodes = []; }
  });
  return node;
}

const fakeDoc = {
  createElement: (tag) => makeNode(tag),
  createTextNode: (text) => {
    const n = makeNode(null);
    n.nodeType = 3;
    n._textContent = text == null ? "" : String(text);
    return n;
  },
  createDocumentFragment: () => makeNode(null)
};

function collectTags(node, acc) {
  acc = acc || [];
  if (node.tagName) acc.push(node.tagName);
  (node.childNodes || []).forEach((c) => collectTags(c, acc));
  return acc;
}

// ---------------------------------------------------------------------------
// validateContent
// ---------------------------------------------------------------------------
test("validateContent accepts a well-formed minimal contract", () => {
  const ok = {
    schema_version: "1",
    profile: {},
    experience: [],
    education: [],
    projects: [],
    publications: [],
    achievements: [],
    skills: {},
    links: {}
  };
  assert.strictEqual(SC.validateContent(ok), ok);
});

test("validateContent rejects non-object root", () => {
  assert.throws(() => SC.validateContent(null), /not an object/);
  assert.throws(() => SC.validateContent([]), /not an object/);
});

test("validateContent rejects a missing schema_version", () => {
  assert.throws(() => SC.validateContent({ profile: {} }), /Missing schema_version/);
});

test("validateContent rejects an unsupported schema version (no silent reinterpretation)", () => {
  const v2 = { schema_version: "2", profile: {}, experience: [], education: [], projects: [], publications: [], achievements: [], skills: {}, links: {} };
  assert.throws(() => SC.validateContent(v2), /Unsupported content schema version: 2/);
});

test("validateContent rejects a non-array required collection", () => {
  const bad = { schema_version: "1", profile: {}, experience: {}, education: [], projects: [], publications: [], achievements: [], skills: {}, links: {} };
  assert.throws(() => SC.validateContent(bad), /experience/);
});

// ---------------------------------------------------------------------------
// Language selection
// ---------------------------------------------------------------------------
test("normalizeLang falls back to en for unknown languages", () => {
  assert.strictEqual(SC.normalizeLang("en"), "en");
  assert.strictEqual(SC.normalizeLang("ru"), "ru");
  assert.strictEqual(SC.normalizeLang("fr"), "en");
  assert.strictEqual(SC.normalizeLang(undefined), "en");
});

test("localized returns the requested language and never invents a translation", () => {
  assert.strictEqual(SC.localized("plain", "ru"), "plain");
  assert.strictEqual(SC.localized({ en: "Hello", ru: "Привет" }, "ru"), "Привет");
  // ru explicitly null => absence, NOT the English fallback.
  assert.strictEqual(SC.localized({ en: "Engineer", ru: null }, "ru"), null);
  assert.strictEqual(SC.localized(null, "en"), null);
});

test("localizedList returns [] for null localized arrays (no fabrication)", () => {
  assert.deepStrictEqual(SC.localizedList({ en: ["a"], ru: null }, "ru"), []);
  assert.deepStrictEqual(SC.localizedList({ en: ["a"], ru: ["б"] }, "ru"), ["б"]);
  assert.deepStrictEqual(SC.localizedList(["x"], "en"), ["x"]);
});

// ---------------------------------------------------------------------------
// Date / period formatting
// ---------------------------------------------------------------------------
test("formatMonth formats machine-readable YYYY-MM", () => {
  assert.strictEqual(SC.formatMonth("2025-08", "en"), "Aug 2025");
  assert.strictEqual(SC.formatMonth("2026-04", "en"), "Apr 2026");
  assert.strictEqual(SC.formatMonth("", "en"), "");
});

test("formatPeriod renders the localized Present token for ongoing items", () => {
  assert.strictEqual(SC.formatPeriod({ start: "2025-08", end: null }, "current", "en"), "Aug 2025 – Present");
  assert.strictEqual(SC.formatPeriod({ start: "2025-08", end: null }, "current", "ru"), "авг 2025 – Настоящее время");
  assert.strictEqual(SC.formatPeriod({ start: "2022-11", end: "2022-12" }, "completed", "en"), "Nov 2022 – Dec 2022");
});

// ---------------------------------------------------------------------------
// URL safety
// ---------------------------------------------------------------------------
test("isSafeUrl allows http(s)/mailto and rejects dangerous schemes", () => {
  assert.ok(SC.isSafeUrl("https://example.com"));
  assert.ok(SC.isSafeUrl("http://example.com"));
  assert.ok(SC.isSafeUrl("mailto:a@b.com"));
  assert.ok(!SC.isSafeUrl("javascript:alert(1)"));
  assert.ok(!SC.isSafeUrl("JavaScript:alert(1)"));
  assert.ok(!SC.isSafeUrl("data:text/html,<script>"));
  assert.ok(!SC.isSafeUrl("vbscript:msgbox"));
  assert.ok(!SC.isSafeUrl(123));
});

// ---------------------------------------------------------------------------
// Patent detection
// ---------------------------------------------------------------------------
test("isPatent identifies patent-* ids only", () => {
  assert.ok(SC.isPatent({ id: "patent-confocal-deconvolution" }));
  assert.ok(!SC.isPatent({ id: "sibircon-2024" }));
  assert.ok(!SC.isPatent({}));
});

// ---------------------------------------------------------------------------
// Metric formatting
// ---------------------------------------------------------------------------
test("formatMetric composes value+unit and tolerates missing fields", () => {
  assert.strictEqual(SC.formatMetric({ value: 99.0, unit: "%" }), "99 %");
  assert.strictEqual(SC.formatMetric({ value: "up to 54%", unit: null }), "up to 54%");
  assert.strictEqual(SC.formatMetric({ name: "x" }), "");
});

// ---------------------------------------------------------------------------
// Link flattening (nested groups + email -> mailto)
// ---------------------------------------------------------------------------
test("flattenLinks walks nested groups and builds mailto from email", () => {
  const links = {
    github: { url: "https://github.com/x", label: "GitHub" },
    telegram: { personal: { url: "https://t.me/x", label: "TG" } },
    research: { orcid: { url: "https://orcid.org/x", label: "ORCID" } },
    email: "me@example.com"
  };
  const flat = SC.flattenLinks(links);
  const urls = flat.map((l) => l.url);
  assert.ok(urls.includes("https://github.com/x"));
  assert.ok(urls.includes("https://t.me/x"));
  assert.ok(urls.includes("https://orcid.org/x"));
  assert.ok(urls.includes("mailto:me@example.com"));
});

// ---------------------------------------------------------------------------
// Security: safe markdown / no script execution
// ---------------------------------------------------------------------------
test("renderMarkdownInto inserts hostile HTML as inert text (no <script> element)", () => {
  const container = makeNode("div");
  SC.renderMarkdownInto(container, "<script>alert(1)</script>", fakeDoc);
  const tags = collectTags(container);
  assert.ok(!tags.includes("SCRIPT"), "no live <script> element is created");
  assert.ok(container.textContent.includes("<script>alert(1)</script>"), "the string survives as literal text");
});

test("markdown links with javascript: scheme are downgraded to plain text", () => {
  const container = makeNode("div");
  SC.renderMarkdownInto(container, "click [here](javascript:alert(1))", fakeDoc);
  const tags = collectTags(container);
  assert.ok(!tags.includes("A"), "no anchor is created for an unsafe URL");
  assert.ok(container.textContent.includes("here"));
});

test("markdown links with https scheme become anchors", () => {
  const container = makeNode("div");
  SC.renderMarkdownInto(container, "see [site](https://example.com)", fakeDoc);
  const tags = collectTags(container);
  assert.ok(tags.includes("A"), "a safe URL produces an anchor");
});

// ---------------------------------------------------------------------------
// Regression: render the real published contract without leaking null/undefined
// ---------------------------------------------------------------------------
test("renderAll renders the real content.json in EN and RU without null/undefined leaks", () => {
  const raw = fs.readFileSync(path.join(__dirname, "..", "assets", "json", "content.json"), "utf8");
  const data = SC.validateContent(JSON.parse(raw));

  ["en", "ru"].forEach((lang) => {
    const frag = SC.renderAll(fakeDoc, data, lang);
    const text = frag.textContent;
    assert.ok(text.length > 0, `${lang}: produced content`);
    assert.ok(!/\bundefined\b/.test(text), `${lang}: no 'undefined' leaked into output`);
    // The inream role has ru:null; ensure the literal token "null" is not shown.
    assert.ok(!/(^|\s)null(\s|$)/.test(text), `${lang}: no 'null' token leaked into output`);
  });
});

test("renderAll RU output omits (not fabricates) the inream Russian role", () => {
  const raw = fs.readFileSync(path.join(__dirname, "..", "assets", "json", "content.json"), "utf8");
  const data = SC.validateContent(JSON.parse(raw));
  const frag = SC.renderAll(fakeDoc, data, "ru");
  // inream role.ru is null -> renderer falls back to the (non-localized)
  // organization name for the title, never an invented Russian string.
  assert.ok(frag.textContent.includes("Inream (Startup)"));
});
