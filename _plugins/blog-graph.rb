# Builds the graph of all blog posts once per site build and stores it in
# site.data["blog_graph"]; _includes/blog_graph.html renders it as finished SVG in the
# top right corner of the blog list pages and of every post that has related posts.
# The browser does no layout work: the same picture appears with every blog page
# (assets/js/related-graph.js only adds hover, drag and the "replay" of how it grew).
#
# Two posts are linked when one mentions the other (url or file slug, "mention")
# or they share a tag ("tag"). Each node also lists its related posts for the post
# pages: mentions first, then by shared tags, then newest, at most
# related_blog_posts.max_related.
#
# The force step below mirrors step() in related-graph.js, which reuses it when a node
# is dragged: keep the two in sync.
#
# The layout is cached (Jekyll::Cache, on disk in .jekyll-cache) under a hash of what it
# depends on: post count and links. It is recomputed only when a post is added or removed or
# links / tags change, not on every build or `jekyll serve` regeneration.
#
# Note: `jekyll serve` loads _plugins only at startup; restart it after changing this file.
require "digest"
require "json"

module Jekyll
  class BlogGraphGenerator < Generator
    safe true
    priority :lowest

    WIDTH = 280
    HEIGHT = 230
    # Bump when the layout algorithm or its constants change: old cached layouts are then ignored.
    LAYOUT_VERSION = 1

    def generate(site)
      posts = site.posts.docs.sort_by(&:date).reverse # newest first, like site.posts in Liquid
      return if posts.size < 2

      nodes = posts.each_with_index.map do |p, i|
        { "id" => i, "title" => p.data["title"].to_s, "url" => p.url,
          "tags" => Array(p.data["tags"]), "date" => p.date.strftime("%Y-%m-%d") }
      end
      edges = build_edges(posts)
      add_related(nodes, edges, (site.config.dig("related_blog_posts", "max_related") || 5).to_i)
      many = nodes.size > 8
      layout(nodes, edges, many)

      edges.each do |e|
        s = nodes[e["source"]]
        t = nodes[e["target"]]
        e.merge!("x1" => s["x"], "y1" => s["y"], "x2" => t["x"], "y2" => t["y"])
      end
      site.data["blog_graph"] = { "width" => WIDTH, "height" => HEIGHT, "many" => many,
                                  "nodes" => nodes, "edges" => edges }
    end

    private

    def build_edges(posts)
      edges = []
      posts.each_with_index do |a, ai|
        a_slug = a.basename_without_ext
        a_tags = Array(a.data["tags"])
        posts.each_with_index do |b, bi|
          next if bi <= ai
          b_slug = b.basename_without_ext
          shared = (a_tags & Array(b.data["tags"])).size
          kind =
            if a.content.include?(b.url) || a.content.include?(b_slug) ||
               b.content.include?(a.url) || b.content.include?(a_slug)
              "mention"
            elsif shared.positive?
              "tag"
            end
          edges << { "source" => ai, "target" => bi, "kind" => kind, "shared" => shared } if kind
        end
      end
      edges
    end

    # node["related"]: ids of the most related posts. Ids are in newest-first order,
    # so a lower id wins a tie.
    def add_related(nodes, edges, max_related)
      candidates = Array.new(nodes.size) { [] }
      edges.each do |e|
        rank = [e["kind"] == "mention" ? 0 : 1, -e["shared"]]
        candidates[e["source"]] << rank + [e["target"]]
        candidates[e["target"]] << rank + [e["source"]]
      end
      nodes.each_with_index do |node, i|
        node["related"] = candidates[i].sort.first(max_related).map(&:last)
      end
    end

    # Stores x / y / r and the label anchor on every node, from the cache when the inputs are unchanged.
    def layout(nodes, edges, many)
      n = nodes.size
      key = Digest::SHA256.hexdigest(JSON.generate(
        [LAYOUT_VERSION, WIDTH, HEIGHT, n, many, edges.map { |e| [e["source"], e["target"]] }]
      ))
      positions = cache.getset(key) do
        started = Time.now
        computed = compute_layout(n, edges, many)
        Jekyll.logger.info "Blog graph:", format("layout of %d posts computed in %.2fs", n, Time.now - started)
        computed
      end

      nodes.each_with_index do |node, i|
        x, y, r = positions[i]
        # Labels of nodes near a side grow inwards, so they are not cut off by the box.
        anchor = if x < 70 then "start" elsif x > WIDTH - 70 then "end" else "middle" end
        node.merge!("x" => x, "y" => y, "r" => r, "anchor" => anchor)
      end
    end

    def cache
      @cache ||= Jekyll::Cache.new("Jekyll::BlogGraphGenerator")
    end

    # Runs the simulation as the browser would have animated it and settles it fully.
    # Returns [[x, y, r], ...] in node order.
    def compute_layout(n, edges, many)
      pts = Array.new(n) do |i|
        a = i.to_f / n * Math::PI * 2
        { x: WIDTH / 2.0 + Math.cos(a) * 80, y: HEIGHT / 2.0 + Math.sin(a) * 80,
          vx: 0.0, vy: 0.0, r: many ? 4.5 : 6 }
      end
      links = edges.map { |e| [pts[e["source"]], pts[e["target"]]] }

      alpha = 1.0
      loop do
        step(pts, links, alpha, many)
        alpha = [alpha * 0.985, 0.02].max
        break if alpha <= 0.03
      end
      # That schedule stops before the layout is at rest, so the first drag in the browser would
      # make the whole graph drift (up to ~25px). Keep stepping until nothing moves: then a drag
      # only moves the dragged node and what it pulls.
      5000.times do
        prev = pts.map { |p| [p[:x], p[:y]] }
        step(pts, links, 0.3, many)
        moved = pts.each_with_index.map { |p, i| Math.hypot(p[:x] - prev[i][0], p[:y] - prev[i][1]) }.max
        break if moved < 0.01
      end

      pts.map { |p| [p[:x].round(2), p[:y].round(2), p[:r]] }
    end

    def step(pts, links, alpha, many)
      narrow = WIDTH < 360
      n = pts.size
      (0...n).each do |i|
        ((i + 1)...n).each do |j|
          a = pts[i]
          b = pts[j]
          dx = b[:x] - a[:x]
          dy = b[:y] - a[:y]
          d = Math.sqrt(dx * dx + dy * dy)
          d = 1.0 if d.zero?
          f = (narrow ? 900 : 2600) * [1, n / 6.0].max / (d * d)
          a[:vx] -= dx / d * f
          a[:vy] -= dy / d * f
          b[:vx] += dx / d * f
          b[:vy] += dy / d * f
        end
      end
      links.each do |s, t|
        dx = t[:x] - s[:x]
        dy = t[:y] - s[:y]
        d = Math.sqrt(dx * dx + dy * dy)
        d = 1.0 if d.zero?
        f = (d - (narrow ? 55 : 110)) * 0.04
        s[:vx] += dx / d * f
        s[:vy] += dy / d * f
        t[:vx] -= dx / d * f
        t[:vy] -= dy / d * f
      end
      pts.each do |p|
        p[:vx] += (WIDTH / 2.0 - p[:x]) * (many ? 0.006 : 0.012)
        p[:vy] += (HEIGHT / 2.0 - p[:y]) * (many ? 0.006 : 0.012)
        p[:x] += p[:vx] * alpha
        p[:y] += p[:vy] * alpha
        p[:vx] *= 0.82
        p[:vy] *= 0.82
        p[:x] = [p[:r] + 8, [WIDTH - p[:r] - 8, p[:x]].min].max
        p[:y] = [p[:r] + 8, [HEIGHT - p[:r] - 22, p[:y]].min].max
      end
    end
  end
end
