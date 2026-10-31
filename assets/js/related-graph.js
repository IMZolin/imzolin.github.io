/*
 * Obsidian-style graph of all blog posts (_includes/blog_graph.html, blog list pages and posts).
 * It is laid out at build time by _plugins/blog-graph.rb and arrives as finished SVG, so nothing
 * is drawn or settled here: this script only makes it interactive.
 * Hover highlights a node's neighbours, drag moves a node (the others follow, then it springs
 * back), a click opens the post; zoom / pan (see zoomable()); the replay button shows how the
 * graph grew; on phones the "Show graph" toggle is remembered for the visit.
 */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var OPEN_KEY = "blog-graph-open"; // also read by the inline script in blog_graph.html

  function svgEl(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  // One step of the force layout. _plugins/blog-graph.rb runs the same step at build time:
  // keep the two in sync, or a dragged blog graph drifts away from its built shape.
  function step(nodes, edges, width, height, alpha) {
    var narrow = width < 360;
    var many = nodes.length > 8;
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
      n.vy += (height / 2 - n.y) * (many ? 0.006 : 0.012);
      if (!n.fixed) {
        n.x += n.vx * alpha; n.y += n.vy * alpha;
      }
      n.vx *= 0.82; n.vy *= 0.82;
      n.x = Math.max(n.r + 8, Math.min(width - n.r - 8, n.x));
      n.y = Math.max(n.r + 8, Math.min(height - n.r - 22, n.y));
    });
  }

  // Hover, tag highlight and drag. The graph starts at rest; the simulation only runs while a
  // node is dragged and until it settles again.
  function interact(svg, nodes, edges, nodeEls, edgeEls, width, height) {
    var neighbours = nodes.map(function () { return {}; });
    edges.forEach(function (e) { neighbours[e.s.id][e.t.id] = true; neighbours[e.t.id][e.s.id] = true; });

    function highlight(n) {
      svg.classList.toggle("rg-dim", !!n);
      nodeEls.forEach(function (g, i) {
        g.classList.toggle("rg-hot", !!n && (nodes[i] === n || neighbours[n.id][nodes[i].id]));
      });
      edgeEls.forEach(function (l, i) {
        l.classList.toggle("rg-hot", !!n && (edges[i].s === n || edges[i].t === n));
      });
    }

    // Hovering a tag on the blog page (assets/js/blog.js) highlights the posts that carry it.
    document.addEventListener("blog-tag-highlight", function (e) {
      var tag = e.detail && e.detail.tag;
      var hot = nodes.map(function (n) { return !!tag && n.tags.indexOf(tag) !== -1; });
      svg.classList.toggle("rg-dim", !!tag);
      nodeEls.forEach(function (g, i) { g.classList.toggle("rg-hot", hot[i]); g.classList.toggle("rg-tagged", hot[i]); });
      edgeEls.forEach(function (l, i) { l.classList.toggle("rg-hot", hot[edges[i].s.id] && hot[edges[i].t.id]); });
    });

    // moved: the pointer went more than 4 screen px from where it was pressed (a drag, not a click).
    var alpha = 0, dragging = null, moved = false, raf = null, downX = 0, downY = 0;

    function draw() {
      edges.forEach(function (e, i) {
        edgeEls[i].setAttribute("x1", e.s.x); edgeEls[i].setAttribute("y1", e.s.y);
        edgeEls[i].setAttribute("x2", e.t.x); edgeEls[i].setAttribute("y2", e.t.y);
      });
      nodes.forEach(function (n, i) {
        nodeEls[i].setAttribute("transform", "translate(" + n.x + "," + n.y + ")");
      });
    }

    function tick() {
      step(nodes, edges, width, height, alpha);
      draw();
      alpha = Math.max(alpha * 0.985, dragging ? 0.3 : 0.02);
      raf = (alpha > 0.03 || dragging) ? requestAnimationFrame(tick) : null;
    }

    function wake() { alpha = Math.max(alpha, 0.5); if (!raf) { raf = requestAnimationFrame(tick); } }

    // Pointer position in graph coordinates, through the current (possibly zoomed) viewBox.
    function point(ev) {
      var r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
      return { x: vb.x + (ev.clientX - r.left) * vb.width / r.width, y: vb.y + (ev.clientY - r.top) * vb.height / r.height };
    }

    // Nodes are real links (<a>): a plain click navigates, a click that ends a drag does not.
    nodeEls.forEach(function (g, i) {
      var n = nodes[i];
      g.addEventListener("mouseenter", function () { highlight(n); });
      g.addEventListener("mouseleave", function () { highlight(null); });
      g.addEventListener("focus", function () { highlight(n); });
      g.addEventListener("blur", function () { highlight(null); });
      g.addEventListener("dragstart", function (e) { e.preventDefault(); });
      g.addEventListener("click", function (e) { if (moved) { e.preventDefault(); } });
      g.addEventListener("pointerdown", function (ev) {
        if (ev.button !== 0) { return; }
        dragging = n; moved = false; n.fixed = true;
        downX = ev.clientX; downY = ev.clientY;
        g.setPointerCapture(ev.pointerId);
        wake();
      });
      g.addEventListener("pointermove", function (ev) {
        if (dragging !== n) { return; }
        if (Math.abs(ev.clientX - downX) + Math.abs(ev.clientY - downY) > 4) { moved = true; }
        var p = point(ev);
        n.x = p.x; n.y = p.y;
      });
      g.addEventListener("pointerup", function () {
        var wasClick = dragging === n && !moved;
        dragging = null; n.fixed = false;
        if (!wasClick) { wake(); }
      });
    });
  }

  // Read the pre-rendered SVG and make it interactive; nothing is redrawn.
  function hydrate(box, svg) {
    var vb = svg.viewBox.baseVal;
    var nodeEls = Array.prototype.slice.call(svg.querySelectorAll(".rg-node"));
    var edgeEls = Array.prototype.slice.call(svg.querySelectorAll(".rg-edge"));
    var nodes = nodeEls.map(function (g, i) {
      var tags;
      try { tags = JSON.parse(g.getAttribute("data-tags") || "[]"); } catch (e) { tags = []; }
      return {
        id: i, url: g.getAttribute("href"), tags: tags, date: g.getAttribute("data-date") || "",
        x: parseFloat(g.getAttribute("data-x")), y: parseFloat(g.getAttribute("data-y")),
        r: parseFloat(g.getAttribute("data-r")), vx: 0, vy: 0, fixed: false
      };
    });
    var edges = edgeEls.map(function (l) {
      return { s: nodes[parseInt(l.getAttribute("data-s"), 10)], t: nodes[parseInt(l.getAttribute("data-t"), 10)] };
    });
    var width = vb.width, height = vb.height;
    var root = box.closest(".related-articles") || box;
    interact(svg, nodes, edges, nodeEls, edgeEls, width, height);
    zoomable(svg, width, height, root);

    var button = root.querySelector("[data-rg-replay]");
    if (button) {
      button.addEventListener("click", function () { replay(svg, nodes, edges, nodeEls, edgeEls, height, button); });
    }
  }

  // Zoom and pan by changing the viewBox. Zoom: Ctrl/⌘ + wheel or trackpad pinch (towards the
  // pointer), two-finger pinch on touch screens, double-click on the background, the − / + / reset
  // buttons. Pan: drag the background while zoomed in. A plain wheel still scrolls the page.
  // Edges keep their width and labels their size (CSS, via --rg-k); nodes grow only with √k,
  // like in Obsidian; labels show from ×3. On a post page the buttons zoom towards the current post.
  function zoomable(svg, width, height, root) {
    var MAX = 6, STEP = 1.5, LABELS_FROM = 3;
    var k = 1, x0 = 0, y0 = 0;
    var bIn = root.querySelector('[data-rg-zoom="in"]');
    var bOut = root.querySelector('[data-rg-zoom="out"]');
    var bReset = root.querySelector('[data-rg-zoom="reset"]');
    var focus = svg.querySelector(".rg-node.rg-current");
    var dots = Array.prototype.map.call(svg.querySelectorAll(".rg-node"), function (a) {
      var label = a.querySelector(".rg-label");
      return { circle: a.querySelector("circle"), label: label, r: parseFloat(a.getAttribute("data-r")),
        lx: label ? parseFloat(label.getAttribute("x") || 0) : 0 };
    });

    function apply() {
      var w = width / k, h = height / k, s = Math.sqrt(k);
      x0 = Math.max(0, Math.min(width - w, x0));
      y0 = Math.max(0, Math.min(height - h, y0));
      svg.setAttribute("viewBox", x0 + " " + y0 + " " + w + " " + h);
      svg.style.setProperty("--rg-k", k);
      svg.classList.toggle("rg-zoomed", k > 1);
      svg.classList.toggle("rg-zoomed-labels", k >= LABELS_FROM);
      dots.forEach(function (d) {
        var r = d.r / s; // drawn at r·√k on screen
        d.circle.setAttribute("r", r);
        if (d.label) { d.label.setAttribute("y", r + 13 / k); d.label.setAttribute("x", d.lx / k); }
      });
      if (bIn) { bIn.disabled = k >= MAX; }
      if (bOut) { bOut.disabled = k <= 1; }
      if (bReset) { bReset.disabled = k <= 1; }
    }

    // Zoom by factor f keeping the graph point (px, py) under the same spot on screen.
    function zoomAt(f, px, py) {
      var nk = Math.max(1, Math.min(MAX, k * f));
      if (nk === k) { return; }
      x0 = px - (px - x0) * k / nk;
      y0 = py - (py - y0) * k / nk;
      k = nk;
      apply();
    }

    function toGraph(cx, cy) {
      var r = svg.getBoundingClientRect();
      return { x: x0 + (cx - r.left) / r.width * width / k, y: y0 + (cy - r.top) / r.height * height / k };
    }

    // Buttons: zoom around the view centre, or keep the current post in the middle of the view.
    function zoomCenter(f) {
      if (!focus) { zoomAt(f, x0 + width / k / 2, y0 + height / k / 2); return; }
      var m = /translate\(([-\d.e]+),\s*([-\d.e]+)\)/.exec(focus.getAttribute("transform") || "");
      k = Math.max(1, Math.min(MAX, k * f));
      x0 = (m ? parseFloat(m[1]) : width / 2) - width / k / 2;
      y0 = (m ? parseFloat(m[2]) : height / 2) - height / k / 2;
      apply();
    }

    if (bIn) { bIn.addEventListener("click", function () { zoomCenter(STEP); }); }
    if (bOut) { bOut.addEventListener("click", function () { zoomCenter(1 / STEP); }); }
    if (bReset) { bReset.addEventListener("click", function () { k = 1; x0 = 0; y0 = 0; apply(); }); }

    svg.addEventListener("wheel", function (e) {
      if (!e.ctrlKey && !e.metaKey) { return; } // trackpad pinch arrives as ctrlKey + wheel
      e.preventDefault();
      var p = toGraph(e.clientX, e.clientY);
      zoomAt(Math.exp(-Math.max(-50, Math.min(50, e.deltaY)) * 0.01), p.x, p.y);
    }, { passive: false });

    function onBackground(e) { return !(e.target.closest && e.target.closest(".rg-node")); }

    svg.addEventListener("dblclick", function (e) {
      if (!onBackground(e)) { return; }
      var p = toGraph(e.clientX, e.clientY);
      if (k >= MAX) { k = 1; x0 = 0; y0 = 0; apply(); } else { zoomAt(2, p.x, p.y); }
    });

    // Background drag pans; two pointers pinch. Node drags are handled in interact().
    var pointers = {}, pan = null, pinchDist = 0;

    function spread() {
      var ps = Object.keys(pointers).map(function (id) { return pointers[id]; });
      return { d: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) || 1, x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 };
    }

    svg.addEventListener("pointerdown", function (e) {
      if (!onBackground(e) || (e.pointerType === "mouse" && e.button !== 0)) { return; }
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      var n = Object.keys(pointers).length;
      if (n === 2) { pinchDist = spread().d; pan = null; }
      else if (n === 1) { pan = { x: e.clientX, y: e.clientY, x0: x0, y0: y0 }; }
    });
    svg.addEventListener("pointermove", function (e) {
      if (!pointers[e.pointerId]) { return; }
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (Object.keys(pointers).length === 2) {
        var s = spread(), p = toGraph(s.x, s.y);
        zoomAt(s.d / pinchDist, p.x, p.y);
        pinchDist = s.d;
      } else if (pan && k > 1) {
        var r = svg.getBoundingClientRect();
        x0 = pan.x0 - (e.clientX - pan.x) / r.width * width / k;
        y0 = pan.y0 - (e.clientY - pan.y) / r.height * height / k;
        apply();
      }
    });
    function release(e) {
      delete pointers[e.pointerId];
      var n = Object.keys(pointers).length;
      if (n === 1) {
        var id = Object.keys(pointers)[0];
        pan = { x: pointers[id].x, y: pointers[id].y, x0: x0, y0: y0 };
      } else if (n === 0) { pan = null; }
    }
    svg.addEventListener("pointerup", release);
    svg.addEventListener("pointercancel", release);

    apply();
  }

  // "How the graph grew": nodes appear in date order where they stand, an edge once both of its
  // posts exist, with the month shown in the corner. Nothing moves, so it never looks broken.
  function replay(svg, nodes, edges, nodeEls, edgeEls, height, button) {
    var order = nodes.map(function (n, i) { return i; }).sort(function (a, b) {
      return nodes[a].date < nodes[b].date ? -1 : (nodes[a].date > nodes[b].date ? 1 : a - b);
    });
    var label = svg.querySelector(".rg-replay-date");
    if (!label) {
      label = svgEl("text", { "class": "rg-replay-date", x: 8, y: height - 8 });
      svg.appendChild(label);
    }
    var shown = {};
    var delay = Math.max(40, Math.min(220, 2400 / nodes.length));
    var k = 0;

    button.disabled = true;
    nodeEls.forEach(function (g) { g.classList.remove("rg-pop"); g.classList.add("rg-pending"); });
    edgeEls.forEach(function (l) { l.classList.add("rg-pending"); });

    (function next() {
      if (k >= order.length) {
        setTimeout(function () {
          label.textContent = "";
          nodeEls.forEach(function (g) { g.classList.remove("rg-pop"); });
          button.disabled = false;
        }, 700);
        return;
      }
      var i = order[k++];
      shown[i] = true;
      nodeEls[i].classList.remove("rg-pending");
      nodeEls[i].classList.add("rg-pop");
      edges.forEach(function (e, j) {
        if (shown[e.s.id] && shown[e.t.id]) { edgeEls[j].classList.remove("rg-pending"); }
      });
      label.textContent = nodes[i].date.slice(0, 7);
      setTimeout(next, delay);
    })();
  }

  // Phones: "Show graph" / "Hide graph", remembered for the visit (sessionStorage).
  function bindToggle(box) {
    var button = box.querySelector("[data-blog-graph-toggle]");
    if (!button) { return; }
    button.addEventListener("click", function () {
      var open = !box.classList.contains("is-open");
      box.classList.toggle("is-open", open);
      button.setAttribute("aria-expanded", open ? "true" : "false");
      try { window.sessionStorage.setItem(OPEN_KEY, open ? "1" : "0"); } catch (e) { /* storage may be blocked */ }
    });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-blog-graph]"), function (box) {
      var svg = box.querySelector("svg[data-static]");
      if (svg) { hydrate(box.querySelector(".related-graph"), svg); }
      bindToggle(box);
    });
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); }
  else { init(); }
})();
