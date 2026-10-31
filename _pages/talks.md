---
layout: page
permalink: /talks/
title: talks & media
i18n_key: talks
description: Talks, conference presentations, interviews and media appearances.
nav: true
nav_order: 2
---

<div class="cv-toolbar">
  <nav class="cv-toc" aria-label="Talks & media sections" data-i18n-attr="aria-label:talks.toc">
    <a href="#section-talks" data-i18n="talks.talks">Talks &amp; conferences</a>
    <a href="#section-interviews" data-i18n="talks.interviews">Interviews</a>
  </nav>
</div>

{% include dynamic_content.html sections="talks,interviews" talks=true news=true %}
