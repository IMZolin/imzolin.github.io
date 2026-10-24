---
layout: page
permalink: /cv/
title: cv
nav: true
nav_order: 4
description: Experience, education, projects, achievements, patents and skills.
---

<div class="cv-toolbar">
  <nav class="cv-toc" aria-label="CV sections">
    <a href="#section-experience">Experience</a>
    <a href="#section-education">Education</a>
    <a href="#section-projects">Projects</a>
    <a href="#section-achievements">Achievements</a>
    <a href="#section-patents">Patents</a>
    <a href="#section-skills">Skills</a>
  </nav>
  <div class="cv-actions">
    <a class="cv-download" data-cv-link="view" href="{{ site.data.cv.en.view | relative_url }}" target="_blank" rel="noopener noreferrer"><i class="fas fa-eye"></i> <span data-cv-label>View CV</span></a>
  </div>
</div>

{% include dynamic_content.html sections="experience,education,projects,achievements,patents,skills" logos=true cv=true %}
