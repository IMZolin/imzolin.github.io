/*
 * Blog page header (blog/index.html):
 *  - "+N" / "less" shows or hides the tags beyond the first row;
 *  - hovering or focusing a tag highlights its posts in the graph (see related-graph.js).
 */
(function () {
  "use strict";

  function bindToggle(button, container, cls) {
    button.addEventListener("click", function () {
      var open = !container.classList.contains(cls);
      container.classList.toggle(cls, open);
      button.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function highlight(tag) {
    var ev;
    try { ev = new CustomEvent("blog-tag-highlight", { detail: { tag: tag } }); }
    catch (e) { ev = document.createEvent("CustomEvent"); ev.initCustomEvent("blog-tag-highlight", false, false, { tag: tag }); }
    document.dispatchEvent(ev);
  }

  function init() {
    var tags = document.querySelector("[data-blog-tags]");
    if (tags) {
      var more = tags.querySelector("[data-blog-tags-toggle]");
      if (more) { bindToggle(more, tags, "is-expanded"); }
      Array.prototype.forEach.call(tags.querySelectorAll("[data-tag]"), function (a) {
        var tag = a.getAttribute("data-tag");
        a.addEventListener("mouseenter", function () { highlight(tag); });
        a.addEventListener("focus", function () { highlight(tag); });
        a.addEventListener("mouseleave", function () { highlight(null); });
        a.addEventListener("blur", function () { highlight(null); });
      });
    }
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); }
  else { init(); }
})();
