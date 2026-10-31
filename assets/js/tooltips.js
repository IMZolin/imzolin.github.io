/*
 * Hover tooltips in the style of the HeroUI (NextUI) tooltip: a small rounded
 * bubble with a soft shadow and an arrow, scale-in animation, instant open and
 * a short close delay. Elements opt in with:
 *   data-tooltip="Text"                    -> tooltip text (read on every show, so i18n.js can rewrite it)
 *   data-tooltip-placement="top|bottom"    -> preferred side (default "top"; flips when there is no room)
 * Shown for mouse hover and keyboard focus only, never for touch.
 */
(function () {
  "use strict";

  var GAP = 10;          // HeroUI: 7px offset + 3px for the arrow
  var EDGE = 12;         // keep the bubble this far from the viewport edges
  var CLOSE_DELAY = 500; // HeroUI default closeDelay
  var EXIT_MS = 150;

  var tip, content, current = null, closeTimer = null, hideTimer = null;

  function build() {
    tip = document.createElement("div");
    tip.className = "site-tooltip";
    tip.setAttribute("aria-hidden", "true"); // the targets carry aria-label already
    tip.hidden = true;
    content = document.createElement("div");
    content.className = "site-tooltip-content";
    tip.appendChild(content);
    document.body.appendChild(tip);
  }

  function place(el) {
    var r = el.getBoundingClientRect();
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var side = el.getAttribute("data-tooltip-placement") === "bottom" ? "bottom" : "top";
    if (side === "top" && r.top - GAP - h < EDGE) { side = "bottom"; }
    else if (side === "bottom" && r.bottom + GAP + h > window.innerHeight - EDGE) { side = "top"; }
    var center = r.left + r.width / 2;
    var left = Math.min(Math.max(center - w / 2, EDGE), window.innerWidth - EDGE - w);
    tip.style.left = left + "px";
    tip.style.top = (side === "top" ? r.top - GAP - h : r.bottom + GAP) + "px";
    tip.style.setProperty("--tooltip-arrow-x", (center - left) + "px");
    tip.setAttribute("data-placement", side);
  }

  function show(el) {
    var text = el.getAttribute("data-tooltip");
    if (!text) { return; }
    clearTimeout(closeTimer);
    clearTimeout(hideTimer);
    var reopen = current !== el || !tip.classList.contains("is-open");
    current = el;
    content.textContent = text;
    tip.hidden = false;
    if (reopen) { tip.classList.remove("is-open"); }
    place(el);
    if (reopen) {
      void tip.offsetWidth; // restart the enter transition
      tip.classList.add("is-open");
    }
  }

  function close() {
    clearTimeout(closeTimer);
    current = null;
    tip.classList.remove("is-open");
    hideTimer = setTimeout(function () { tip.hidden = true; }, EXIT_MS);
  }

  function hide(now) {
    if (!current) { return; }
    clearTimeout(closeTimer);
    if (now) { close(); } else { closeTimer = setTimeout(close, CLOSE_DELAY); }
  }

  function targetOf(node) {
    return node && node.closest ? node.closest("[data-tooltip]") : null;
  }

  function init() {
    build();
    document.addEventListener("pointerover", function (e) {
      if (e.pointerType !== "mouse") { return; }
      var el = targetOf(e.target);
      if (el) { show(el); }
    });
    document.addEventListener("pointerout", function (e) {
      if (!current || e.pointerType !== "mouse") { return; }
      if (e.relatedTarget && current.contains(e.relatedTarget)) { return; }
      if (targetOf(e.target) === current) { hide(false); }
    });
    // Pressing a button closes its tooltip, as in HeroUI.
    document.addEventListener("pointerdown", function () { hide(true); });
    document.addEventListener("focusin", function (e) {
      var el = targetOf(e.target);
      if (el && e.target.matches && e.target.matches(":focus-visible")) { show(el); }
    });
    document.addEventListener("focusout", function (e) {
      if (current && targetOf(e.target) === current) { hide(true); }
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { hide(true); } });
    window.addEventListener("scroll", function () { hide(true); }, { passive: true, capture: true });
    window.addEventListener("resize", function () { hide(true); });
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); }
  else { init(); }
})();
