/*
 * Obsidian-style graph of related blog posts.
 * Reads {nodes, edges} from the inline JSON next to it, runs a small force
 * simulation and draws it as SVG. Drag moves a node, hover highlights its
 * neighbours, a click (without dragging) opens the post.
 */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";

  function svgEl(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  function build(box) {
    var dataEl = box.querySelector(".related-graph-data");
    var data;
    try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }
    if (!data.nodes || data.nodes.length < 2) { return; }

    var width = box.clientWidth || 400;
    var HEIGHT = parseInt(box.getAttribute("data-height"), 10) || 320;
    var narrow = width < 360;
    var many = data.nodes.length > 8;
    var nodes = data.nodes.map(function (n, i) {
      var a = (i / data.nodes.length) * Math.PI * 2;
      return {
        id: n.id, title: n.title, url: n.url, current: n.current,
        x: width / 2 + (n.current ? 0 : Math.cos(a) * 80),
        y: HEIGHT / 2 + (n.current ? 0 : Math.sin(a) * 80),
        vx: 0, vy: 0, r: n.current ? 9 : (many ? 4.5 : 6), fixed: false
      };
    });
    var edges = data.edges.map(function (e) {
      return { s: nodes[e.source], t: nodes[e.target], kind: e.kind };
    });
    var neighbours = nodes.map(function () { return {}; });
    edges.forEach(function (e) { neighbours[e.s.id][e.t.id] = true; neighbours[e.t.id][e.s.id] = true; });

    var svg = svgEl("svg", { "class": "rg-svg" + (many ? " rg-many" : ""), viewBox: "0 0 " + width + " " + HEIGHT, role: "img",
      "aria-label": "Graph of blog articles" });
    var edgeEls = edges.map(function (e) {
      var l = svgEl("line", { "class": "rg-edge rg-edge-" + e.kind });
      svg.appendChild(l);
      return l;
    });
    var nodeEls = nodes.map(function (n) {
      var g = svgEl("g", { "class": "rg-node" + (n.current ? " rg-current" : ""), tabindex: "0", role: "link" });
      g.appendChild(svgEl("circle", { r: n.r }));
      var label = svgEl("text", { "class": "rg-label", y: n.r + 13, "text-anchor": "middle" });
      label.textContent = n.title.replace(/^Test:\s*/, "");
      g.appendChild(label);
      var title = svgEl("title", {});
      title.textContent = n.title;
      g.appendChild(title);
      svg.appendChild(g);
      return g;
    });
    box.textContent = "";
    box.appendChild(svg);

    function highlight(n) {
      svg.classList.toggle("rg-dim", !!n);
      nodeEls.forEach(function (g, i) {
        g.classList.toggle("rg-hot", !!n && (nodes[i] === n || neighbours[n.id][nodes[i].id]));
      });
      edgeEls.forEach(function (l, i) {
        l.classList.toggle("rg-hot", !!n && (edges[i].s === n || edges[i].t === n));
      });
    }

    var alpha = 1, dragging = null, moved = false, raf = null;

    function tick() {
      var i, j, a, b, dx, dy, d, f;
      for (i = 0; i < nodes.length; i++) {
        for (j = i + 1; j < nodes.length; j++) {
          a = nodes[i]; b = nodes[j];
          dx = b.x - a.x; dy = b.y - a.y;
          d = Math.sqrt(dx * dx + dy * dy) || 1;
          f = (narrow ? 900 : 2600) * Math.max(1, nodes.length / 6) / (d * d);
          a.vx -= dx / d * f; a.vy -= dy / d * f;
          b.vx += dx / d * f; b.vy += dy / d * f;
        }
      }
      edges.forEach(function (e) {
        dx = e.t.x - e.s.x; dy = e.t.y - e.s.y;
        d = Math.sqrt(dx * dx + dy * dy) || 1;
        f = (d - (narrow ? 55 : 110)) * 0.04;
        e.s.vx += dx / d * f; e.s.vy += dy / d * f;
        e.t.vx -= dx / d * f; e.t.vy -= dy / d * f;
      });
      nodes.forEach(function (n) {
        n.vx += (width / 2 - n.x) * (many ? 0.006 : 0.012);
        n.vy += (HEIGHT / 2 - n.y) * (many ? 0.006 : 0.012);
        if (!n.fixed) {
          n.x += n.vx * alpha; n.y += n.vy * alpha;
        }
        n.vx *= 0.82; n.vy *= 0.82;
        n.x = Math.max(n.r + 8, Math.min(width - n.r - 8, n.x));
        n.y = Math.max(n.r + 8, Math.min(HEIGHT - n.r - 22, n.y));
      });
      draw();
      alpha = Math.max(alpha * 0.985, dragging ? 0.3 : 0.02);
      raf = (alpha > 0.03 || dragging) ? requestAnimationFrame(tick) : null;
    }

    function draw() {
      edges.forEach(function (e, i) {
        edgeEls[i].setAttribute("x1", e.s.x); edgeEls[i].setAttribute("y1", e.s.y);
        edgeEls[i].setAttribute("x2", e.t.x); edgeEls[i].setAttribute("y2", e.t.y);
      });
      nodes.forEach(function (n, i) {
        nodeEls[i].setAttribute("transform", "translate(" + n.x + "," + n.y + ")");
      });
    }

    function wake() { alpha = Math.max(alpha, 0.5); if (!raf) { raf = requestAnimationFrame(tick); } }

    function point(ev) {
      var r = svg.getBoundingClientRect();
      return { x: (ev.clientX - r.left) * width / r.width, y: (ev.clientY - r.top) * HEIGHT / r.height };
    }

    nodeEls.forEach(function (g, i) {
      var n = nodes[i];
      g.addEventListener("mouseenter", function () { highlight(n); });
      g.addEventListener("mouseleave", function () { highlight(null); });
      g.addEventListener("focus", function () { highlight(n); });
      g.addEventListener("blur", function () { highlight(null); });
      g.addEventListener("keydown", function (e) { if (e.key === "Enter") { window.location.href = n.url; } });
      g.addEventListener("pointerdown", function (ev) {
        dragging = n; moved = false; n.fixed = true;
        g.setPointerCapture(ev.pointerId);
        wake();
      });
      g.addEventListener("pointermove", function (ev) {
        if (dragging !== n) { return; }
        var p = point(ev);
        if (Math.abs(p.x - n.x) + Math.abs(p.y - n.y) > 3) { moved = true; }
        n.x = p.x; n.y = p.y;
      });
      g.addEventListener("pointerup", function () {
        var wasClick = dragging === n && !moved;
        dragging = null; n.fixed = false;
        if (wasClick) { window.location.href = n.url; } else { wake(); }
      });
    });

    raf = requestAnimationFrame(tick);
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll(".related-graph"), build);
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); }
  else { init(); }
})();
