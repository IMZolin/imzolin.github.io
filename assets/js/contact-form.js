/* Contact form: file attach (click / drag & drop), limits, AJAX submit. */
(function () {
  "use strict";

  function T(key, vars, fallback) {
    return window.SiteI18n ? window.SiteI18n.t(key, vars, fallback) : (fallback || "");
  }

  var MAX_FILES = 5;
  var MAX_FILE_BYTES = 100 * 1024 * 1024;
  var MAX_TOTAL_BYTES = 25 * 1024 * 1024;

  var form, drop, picker, list, status, files = [];

  function fmt(bytes) {
    if (bytes >= 1048576) { return (bytes / 1048576).toFixed(1) + " MB"; }
    return Math.max(1, Math.round(bytes / 1024)) + " KB";
  }

  function say(msg, isError) {
    status.textContent = msg;
    status.classList.toggle("error", !!isError);
  }

  function total() {
    return files.reduce(function (n, f) { return n + f.size; }, 0);
  }

  function addFiles(incoming) {
    var problems = [];
    Array.prototype.forEach.call(incoming, function (f) {
      if (files.length >= MAX_FILES) { problems.push(T("contact.maxFiles", { n: MAX_FILES })); return; }
      if (f.size > MAX_FILE_BYTES) { problems.push(T("contact.tooBig", { name: f.name })); return; }
      if (total() + f.size > MAX_TOTAL_BYTES) { problems.push(T("contact.totalBig", { name: f.name })); return; }
      files.push(f);
    });
    renderFiles();
    say(problems.length ? problems.filter(function (p, i, a) { return a.indexOf(p) === i; }).join(" ") : "", problems.length > 0);
  }

  function renderFiles() {
    list.textContent = "";
    files.forEach(function (f, i) {
      var li = document.createElement("li");
      var name = document.createElement("span");
      name.textContent = f.name + " (" + fmt(f.size) + ")";
      var rm = document.createElement("button");
      rm.type = "button";
      rm.setAttribute("aria-label", T("contact.remove", { name: f.name }));
      rm.textContent = "×";
      rm.addEventListener("click", function () { files.splice(i, 1); renderFiles(); say(""); });
      li.appendChild(name);
      li.appendChild(rm);
      list.appendChild(li);
    });
  }

  function submit(e) {
    e.preventDefault();
    var btn = form.querySelector(".contact-submit");
    if (!form.checkValidity()) { form.reportValidity(); return; }

    var data = new FormData(form);
    files.forEach(function (f, i) { data.append("attachment" + (i ? i + 1 : ""), f, f.name); });

    btn.disabled = true;
    say(T("contact.sending"));
    fetch(form.action, { method: "POST", body: data, headers: { Accept: "application/json" } })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (!res.ok || res.body.success === "false" || res.body.success === false) {
          var err = new Error(res.body.message || "Request failed");
          err.fromServer = true;
          throw err;
        }
        form.reset();
        files = [];
        renderFiles();
        say(T("contact.thanks"));
      })
      .catch(function (err) {
        if (window.console && console.error) { console.error("[contact-form]", err); }
        var detail = err && err.fromServer ? " (" + err.message + ")" : "";
        say(T("contact.fail") + detail + T("contact.failTail"), true);
      })
      .then(function () { btn.disabled = false; });
  }

  function clock() {
    var el = document.querySelector("[data-contact-tz]");
    if (!el) { return; }
    var tz = el.getAttribute("data-contact-tz");
    function tick() {
      try {
        el.textContent = "· " + new Intl.DateTimeFormat(window.SiteI18n && window.SiteI18n.getLang() === "ru" ? "ru" : [], { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date());
      } catch (err) { el.textContent = ""; }
    }
    tick();
    setInterval(tick, 30000);
  }

  function init() {
    form = document.getElementById("contact-form");
    if (!form) { return; }
    drop = document.getElementById("contact-drop");
    picker = document.getElementById("contact-files");
    list = document.getElementById("contact-file-list");
    status = document.getElementById("contact-status");

    drop.addEventListener("click", function () { picker.click(); });
    drop.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); picker.click(); }
    });
    picker.addEventListener("change", function () { addFiles(picker.files); picker.value = ""; });
    ["dragenter", "dragover"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("dragover"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("dragover"); });
    });
    drop.addEventListener("drop", function (e) { addFiles(e.dataTransfer.files); });
    form.addEventListener("submit", submit);
    clock();
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); }
  else { init(); }
})();
