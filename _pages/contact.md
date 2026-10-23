---
layout: page
permalink: /contact/
title: contact
description: Get in touch.
---

<div class="contact">
  <div class="contact-info">
    <p class="contact-lead">Questions, collaboration or a project idea? Send a message and I'll get back to you.</p>

    <ul class="contact-details">
      <li><i class="fas fa-envelope"></i><a href="mailto:{{ site.data.contact.email }}">{{ site.data.contact.email }}</a></li>
      <li><i class="fas fa-location-dot"></i><span>{{ site.data.contact.location }}</span></li>
      <li><i class="fas fa-clock"></i><span>{{ site.data.contact.timezone }} <span class="contact-time" data-contact-tz="{{ site.data.contact.timezone_iana }}"></span></span></li>
    </ul>

    <div class="contact-socials">
      {%- for s in site.data.contact.socials %}
      <a href="{{ s.url }}" title="{{ s.title }}" aria-label="{{ s.title }}"{% unless s.url contains 'mailto:' %} target="_blank" rel="noopener noreferrer"{% endunless %}><i class="{{ s.icon }}"></i></a>
      {%- endfor %}
    </div>
  </div>

  <form id="contact-form" class="contact-form" action="https://formsubmit.co/ajax/{{ site.data.contact.email }}" method="POST" enctype="multipart/form-data" novalidate>
    <label class="contact-field">
      <span>Name</span>
      <input type="text" name="name" required autocomplete="name">
    </label>
    <label class="contact-field">
      <span>Email</span>
      <input type="email" name="email" required autocomplete="email">
    </label>
    <label class="contact-field">
      <span>Message</span>
      <textarea name="message" rows="6" required></textarea>
    </label>

    <div class="contact-field">
      <span>Attach files</span>
      <div id="contact-drop" class="contact-drop" tabindex="0" role="button" aria-label="Attach files">
        <i class="fas fa-paperclip"></i>
        <span><strong>Choose files</strong> or drag and drop them here</span>
        <small>Up to 5 files, 100 MB each (25 MB total)</small>
        <input id="contact-files" type="file" multiple hidden>
      </div>
      <ul id="contact-file-list" class="contact-file-list"></ul>
    </div>

    <!-- Spam honeypot and FormSubmit options -->
    <input type="text" name="_honey" class="contact-honey" tabindex="-1" autocomplete="off" aria-hidden="true">
    <input type="hidden" name="_captcha" value="false">
    <input type="hidden" name="_template" value="table">
    <input type="hidden" name="_subject" value="New message from imzolin.github.io">

    <button type="submit" class="contact-submit btn btn-outline-primary">Send message</button>
    <p id="contact-status" class="contact-status" role="status" aria-live="polite"></p>
  </form>
</div>

<script defer src="{{ '/assets/js/contact-form.js' | relative_url | bust_file_cache }}"></script>
