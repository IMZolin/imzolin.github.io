---
layout: about
title: about
permalink: /

profile:
  align: right
  image: avatar.jpg
  image_circular: false # rounded square (see .profile img in _sass/_base.scss)
  address: >

# The professional content below is loaded dynamically from
# /assets/json/content.json (published by the personal-os repository).
# The al-folio news / posts / bib / config-social blocks are intentionally
# disabled here so this page has a single runtime source of truth for the
# professional facts. The Jekyll /blog/ and /news/ features remain intact.
news: false
latest_posts: false
selected_papers: false
social: false
---

{% include dynamic_content.html sections="profile,news,selected,blog" news=true selected="tridefusion-v1,tridefusion-v2" %}
