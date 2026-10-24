---
layout: page
permalink: /cv/
title: cv
nav: true
nav_order: 4
description: Experience, education, projects, achievements and skills.
cv_pdf: Ivan_Zolin_CV.pdf # put the file in assets/pdf/ — the button appears once it exists
---

{%- assign cv_pdf_path = page.cv_pdf | prepend: '/assets/pdf/' -%}
{%- assign cv_pdf_file = site.static_files | where: 'path', cv_pdf_path | first -%}

<div class="cv-toolbar">
  <nav class="cv-toc" aria-label="CV sections">
    <a href="#section-experience">Experience</a>
    <a href="#section-education">Education</a>
    <a href="#section-projects">Projects</a>
    <a href="#section-achievements">Achievements</a>
    <a href="#section-skills">Skills</a>
  </nav>
  {%- if cv_pdf_file %}
  <a class="cv-download" href="{{ cv_pdf_path | relative_url }}" download><i class="fas fa-download"></i> Download CV</a>
  {%- endif %}
</div>

{% include dynamic_content.html sections="experience,education,projects,achievements,skills" %}
