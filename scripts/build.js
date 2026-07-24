#!/usr/bin/env node
/*
 * Static site generator for Gulf Events Jobs.
 * Reads data/jobs.json and renders SEO-first static HTML at the repo root:
 * clean URLs, per-job JobPosting JSON-LD, sitemap.xml and long-tail
 * location/category landing pages. No runtime dependencies.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* ----------------------------- site config ------------------------------ */
// Set SITE_URL to your production domain before building for launch, e.g.
//   SITE_URL=https://gulfeventsjobs.com npm run build
// It is used for canonical URLs, Open Graph tags and the sitemap only.
const SITE_URL = (process.env.SITE_URL || 'https://gulfeventsjobs.com').replace(/\/$/, '');
// BASE_PATH lets the site live under a sub-path (e.g. a GitHub Pages project
// site served at /eventexhibition/). Root-absolute links are rewritten to it.
const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');
const SITE_NAME = 'Gulf Events Jobs';
const SITE_TAGLINE = 'Event & Exhibition Jobs in the Gulf';
const SITE_DESCRIPTION =
  'The Gulf region’s dedicated job board for event and exhibition careers. Browse the latest event manager, exhibition, production, AV and event sales jobs across the UAE, Saudi Arabia, Qatar, Kuwait, Bahrain and Oman.';
const CONTACT_EMAIL = 'careers@gulfeventsjobs.com';
const POWERED_BY = 'Business Umbrella';
const POWERED_BY_URL = 'https://businessumbrella.com';
const TWITTER_HANDLE = '@gulfeventsjobs';

/* ------------------------------ utilities ------------------------------- */
function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonLd(obj) {
  // JSON-LD is embedded in a <script> block; escape the closing tag only.
  return JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writePage(relPath, html) {
  const outPath = path.join(ROOT, relPath);
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, html.trimStart() + '\n', 'utf8');
  return relPath;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  if (isNaN(d)) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const PERIOD_LABEL = { MONTH: 'month', YEAR: 'year', HOUR: 'hour', DAY: 'day' };
function formatSalary(job) {
  if (!job.salaryMin && !job.salaryMax) return '';
  const fmt = (n) => n.toLocaleString('en-US');
  const range = job.salaryMax && job.salaryMax !== job.salaryMin
    ? `${fmt(job.salaryMin)}–${fmt(job.salaryMax)}`
    : fmt(job.salaryMin || job.salaryMax);
  return `${job.currency} ${range} / ${PERIOD_LABEL[job.salaryPeriod] || 'month'}`;
}

const EMPLOYMENT_LABEL = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACTOR: 'Contract',
  TEMPORARY: 'Temporary',
  INTERN: 'Internship',
};

function jobUrl(job) {
  return `jobs/${job.slug}/`;
}

/* --------------------------- layout / chrome ---------------------------- */
function head(opts) {
  const {
    title,
    description,
    canonical, // relative path like '' or 'about/'
    extraLd = [],
    ogType = 'website',
  } = opts;
  const canonicalUrl = `${SITE_URL}/${canonical || ''}`;
  const ldBlocks = extraLd
    .map((ld) => `  <script type="application/ld+json">\n${jsonLd(ld)}\n  </script>`)
    .join('\n');
  return `
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(canonicalUrl)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="theme-color" content="#0b2545" />
  <meta property="og:type" content="${esc(ogType)}" />
  <meta property="og:site_name" content="${esc(SITE_NAME)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(canonicalUrl)}" />
  <meta property="og:image" content="${esc(SITE_URL)}/assets/og-image.svg" />
  <meta property="og:locale" content="en_AE" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="${esc(TWITTER_HANDLE)}" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(SITE_URL)}/assets/og-image.svg" />
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/assets/favicon.svg" />
  <link rel="manifest" href="/site.webmanifest" />
  <link rel="preload" href="/assets/styles.css" as="style" />
  <link rel="stylesheet" href="/assets/styles.css" />
${ldBlocks}`;
}

function header(active) {
  const link = (href, label, key) =>
    `<a href="/${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="/" aria-label="${esc(SITE_NAME)} home">
        <img src="/assets/logo.svg" alt="" width="34" height="34" />
        <span class="brand-text"><strong>Gulf Events</strong> Jobs</span>
      </a>
      <nav class="site-nav" aria-label="Primary">
        ${link('', 'Browse Jobs', 'home')}
        ${link('locations/', 'Locations', 'locations')}
        ${link('categories/', 'Categories', 'categories')}
        ${link('about/', 'About', 'about')}
        ${link('post-a-job/', 'Post a Job', 'post')}
      </nav>
    </div>
  </header>`;
}

function footer() {
  const year = 2026;
  return `
  <footer class="site-footer">
    <div class="container footer-grid">
      <div>
        <a class="brand brand--footer" href="/">
          <img src="/assets/logo.svg" alt="" width="30" height="30" />
          <span class="brand-text"><strong>Gulf Events</strong> Jobs</span>
        </a>
        <p class="footer-tagline">${esc(SITE_DESCRIPTION)}</p>
      </div>
      <nav aria-label="Footer">
        <h2 class="footer-h">Explore</h2>
        <ul>
          <li><a href="/">All Jobs</a></li>
          <li><a href="/locations/">Jobs by Location</a></li>
          <li><a href="/categories/">Jobs by Category</a></li>
          <li><a href="/post-a-job/">Post a Job</a></li>
          <li><a href="/about/">About Us</a></li>
        </ul>
      </nav>
      <div>
        <h2 class="footer-h">Get in touch</h2>
        <p><a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a></p>
        <p class="powered">Powered by
          <a href="${esc(POWERED_BY_URL)}" rel="noopener">${esc(POWERED_BY)}</a>
        </p>
      </div>
    </div>
    <div class="container footer-legal">
      <p>&copy; ${year} ${esc(SITE_NAME)}. All rights reserved.</p>
      <p>Serving the UAE, Saudi Arabia, Qatar, Kuwait, Bahrain &amp; Oman.</p>
    </div>
  </footer>`;
}

function layout(opts, bodyHtml) {
  const doc = `<!DOCTYPE html>
<html lang="en">
<head>${head(opts)}
</head>
<body>
${header(opts.active)}
<main id="main">
${bodyHtml}
</main>
${footer()}
<script src="/assets/app.js" defer></script>
</body>
</html>`;
  // Rewrite root-absolute asset/link URLs to the configured base path.
  // Only touches href="/… and src="/…; absolute (http/mailto) and #anchor
  // URLs are left untouched.
  return BASE ? doc.replace(/(href|src)="\//g, `$1="${BASE}/`) : doc;
}

function breadcrumbs(items) {
  // items: [{name, href}]  href relative, last item current (no link)
  const nav = items
    .map((it, i) => {
      const last = i === items.length - 1;
      if (last) return `<li aria-current="page">${esc(it.name)}</li>`;
      return `<li><a href="/${it.href}">${esc(it.name)}</a></li>`;
    })
    .join('');
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}/${it.href || ''}`,
    })),
  };
  return {
    html: `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${nav}</ol></nav>`,
    ld,
  };
}

/* ------------------------------ job cards ------------------------------- */
function jobCard(job) {
  const salary = formatSalary(job);
  return `
      <article class="job-card"
        data-category="${esc(job.category)}"
        data-country="${esc(job.country)}"
        data-city="${esc(job.city)}"
        data-type="${esc(job.employmentType)}"
        data-search="${esc((job.title + ' ' + job.company + ' ' + job.city + ' ' + job.country + ' ' + job.category).toLowerCase())}">
        ${job.featured ? '<span class="badge badge--featured">Featured</span>' : ''}
        <h3 class="job-card__title"><a href="/${jobUrl(job)}">${esc(job.title)}</a></h3>
        <p class="job-card__company">${esc(job.company)}</p>
        <ul class="job-card__meta">
          <li class="meta-loc">${esc(job.city)}, ${esc(job.country)}</li>
          <li class="meta-cat">${esc(job.category)}</li>
          <li class="meta-type">${esc(EMPLOYMENT_LABEL[job.employmentType] || job.employmentType)}</li>
        </ul>
        <p class="job-card__summary">${esc(job.summary)}</p>
        <div class="job-card__foot">
          ${salary ? `<span class="job-card__salary">${esc(salary)}</span>` : '<span></span>'}
          <a class="btn btn--ghost" href="/${jobUrl(job)}">View job<span aria-hidden="true"> &rarr;</span></a>
        </div>
      </article>`;
}

/* ------------------------------- pages ---------------------------------- */
function buildHome(jobs, categories, locations) {
  const featured = jobs.filter((j) => j.featured);
  const catOptions = categories
    .map((c) => `<option value="${esc(c.name)}">${esc(c.name)} (${c.count})</option>`)
    .join('');
  const countryList = [...new Set(jobs.map((j) => j.country))].sort();
  const countryOptions = countryList
    .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
    .join('');

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Event & Exhibition Jobs in the Gulf',
    numberOfItems: jobs.length,
    itemListElement: jobs.map((job, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/${jobUrl(job)}`,
      name: job.title,
    })),
  };
  const websiteLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL + '/',
    description: SITE_DESCRIPTION,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
  const orgLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL + '/',
    logo: `${SITE_URL}/assets/logo.svg`,
    description: SITE_DESCRIPTION,
    email: CONTACT_EMAIL,
    areaServed: ['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman'],
    parentOrganization: { '@type': 'Organization', name: POWERED_BY, url: POWERED_BY_URL },
  };

  const body = `
  <section class="hero">
    <div class="container">
      <p class="hero__eyebrow">${esc(jobs.length)} live roles across the GCC</p>
      <h1 class="hero__title">Event &amp; Exhibition Jobs<br />in the Gulf Region</h1>
      <p class="hero__lede">${esc(SITE_DESCRIPTION)}</p>
      <form class="searchbar" id="search-form" role="search" aria-label="Search jobs">
        <div class="searchbar__field">
          <label class="visually-hidden" for="q">Search jobs</label>
          <input type="search" id="q" name="q" placeholder="Job title, company or keyword…" autocomplete="off" />
        </div>
        <div class="searchbar__field">
          <label class="visually-hidden" for="filter-country">Country</label>
          <select id="filter-country" name="country">
            <option value="">All countries</option>
            ${countryOptions}
          </select>
        </div>
        <div class="searchbar__field">
          <label class="visually-hidden" for="filter-category">Category</label>
          <select id="filter-category" name="category">
            <option value="">All categories</option>
            ${catOptions}
          </select>
        </div>
        <button class="btn btn--primary" type="submit">Search</button>
      </form>
      <p class="hero__chips">
        Popular:
        <a href="/categories/event-management/">Event Management</a>
        <a href="/categories/exhibition-stands/">Exhibition &amp; Stands</a>
        <a href="/categories/production-av/">Production &amp; AV</a>
        <a href="/locations/united-arab-emirates/">UAE</a>
        <a href="/locations/saudi-arabia/">Saudi Arabia</a>
      </p>
    </div>
  </section>

  ${featured.length ? `
  <section class="section" aria-labelledby="featured-h">
    <div class="container">
      <h2 class="section__title" id="featured-h">Featured roles</h2>
      <div class="job-grid">
        ${featured.map(jobCard).join('')}
      </div>
    </div>
  </section>` : ''}

  <section class="section section--muted" aria-labelledby="all-h">
    <div class="container">
      <div class="section__head">
        <h2 class="section__title" id="all-h">All event &amp; exhibition jobs</h2>
        <p class="results-count" id="results-count" aria-live="polite">${jobs.length} jobs</p>
      </div>
      <div class="job-grid" id="job-list">
        ${jobs.map(jobCard).join('')}
      </div>
      <p class="no-results" id="no-results" hidden>No jobs match your search. <button type="button" class="linklike" id="clear-filters">Clear filters</button></p>
    </div>
  </section>

  <section class="section cta-band">
    <div class="container cta-band__inner">
      <div>
        <h2>Hiring for an event or exhibition role?</h2>
        <p>Reach thousands of specialist event professionals across the Gulf.</p>
      </div>
      <a class="btn btn--primary btn--lg" href="/post-a-job/">Post a Job</a>
    </div>
  </section>`;

  return layout(
    {
      title: `${SITE_NAME} — ${SITE_TAGLINE} | UAE, Saudi, Qatar & GCC`,
      description: SITE_DESCRIPTION,
      canonical: '',
      active: 'home',
      extraLd: [websiteLd, orgLd, itemListLd],
    },
    body
  );
}

function buildJobPage(job, related) {
  const salary = formatSalary(job);
  const bc = breadcrumbs([
    { name: 'Home', href: '' },
    { name: job.category, href: `categories/${slugify(job.category)}/` },
    { name: job.title, href: jobUrl(job) },
  ]);

  const descriptionHtml = `
      <p>${esc(job.summary)}</p>
      <h2>Key responsibilities</h2>
      <ul>${job.responsibilities.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      <h2>What you’ll need</h2>
      <ul>${job.requirements.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      <h2>About ${esc(job.company)}</h2>
      <p>${esc(job.companyDescription)}</p>`;

  // Google-friendly JobPosting schema (plain-text description).
  const plainDescription = [
    job.summary,
    'Key responsibilities: ' + job.responsibilities.join('; ') + '.',
    'Requirements: ' + job.requirements.join('; ') + '.',
    'About ' + job.company + ': ' + job.companyDescription,
  ].join(' ');

  const jobLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: plainDescription,
    datePosted: job.datePosted,
    validThrough: job.validThrough,
    employmentType: job.employmentType,
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company,
      sameAs: SITE_URL + '/',
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.city,
        addressCountry: job.countryCode,
      },
    },
    applicantLocationRequirements: {
      '@type': 'Country',
      name: job.country,
    },
    directApply: true,
    identifier: {
      '@type': 'PropertyValue',
      name: SITE_NAME,
      value: job.id,
    },
  };
  if (job.salaryMin) {
    jobLd.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: job.currency,
      value: {
        '@type': 'QuantitativeValue',
        minValue: job.salaryMin,
        maxValue: job.salaryMax || job.salaryMin,
        unitText: job.salaryPeriod,
      },
    };
  }

  const applySubject = encodeURIComponent(`Application: ${job.title} (${job.id})`);
  const applyBody = encodeURIComponent(
    `Hello ${job.company} team,\n\nI would like to apply for the ${job.title} role advertised on Gulf Events Jobs.\n\nPlease find my CV attached.\n\nKind regards,`
  );

  const body = `
  <div class="container">
    ${bc.html}
    <div class="job-detail">
      <article class="job-detail__main">
        <header class="job-detail__head">
          ${job.featured ? '<span class="badge badge--featured">Featured</span>' : ''}
          <h1>${esc(job.title)}</h1>
          <p class="job-detail__company">${esc(job.company)}</p>
          <ul class="job-detail__facts">
            <li><span>Location</span>${esc(job.city)}, ${esc(job.country)}</li>
            <li><span>Category</span>${esc(job.category)}</li>
            <li><span>Type</span>${esc(EMPLOYMENT_LABEL[job.employmentType] || job.employmentType)}</li>
            ${salary ? `<li><span>Salary</span>${esc(salary)}</li>` : ''}
            <li><span>Posted</span>${esc(formatDate(job.datePosted))}</li>
          </ul>
        </header>
        <div class="prose">
          ${descriptionHtml}
        </div>
      </article>
      <aside class="job-detail__aside">
        <div class="apply-card">
          <h2>Apply for this role</h2>
          ${salary ? `<p class="apply-card__salary">${esc(salary)}</p>` : ''}
          <a class="btn btn--primary btn--block" href="mailto:${esc(CONTACT_EMAIL)}?subject=${applySubject}&body=${applyBody}">Apply now</a>
          <p class="apply-card__note">Applications are handled by ${esc(SITE_NAME)}, powered by ${esc(POWERED_BY)}.</p>
          <dl class="apply-card__list">
            <dt>Closes</dt><dd>${esc(formatDate(job.validThrough))}</dd>
            <dt>Reference</dt><dd>${esc(job.id.toUpperCase())}</dd>
          </dl>
        </div>
      </aside>
    </div>

    ${related.length ? `
    <section class="section related">
      <h2 class="section__title">Similar jobs</h2>
      <div class="job-grid">
        ${related.map(jobCard).join('')}
      </div>
    </section>` : ''}
  </div>`;

  const metaDesc = `${job.title} at ${job.company} in ${job.city}, ${job.country}. ${job.summary}`.slice(0, 300);
  return layout(
    {
      title: `${job.title} — ${job.company} | ${job.city} | ${SITE_NAME}`,
      description: metaDesc,
      canonical: jobUrl(job),
      active: 'home',
      ogType: 'article',
      extraLd: [jobLd, bc.ld],
    },
    body
  );
}

function buildListingLanding(opts) {
  // opts: { kind:'category'|'location', name, slug, canonical, title, description, jobs, backHref, backLabel, allEntries }
  const bc = breadcrumbs([
    { name: 'Home', href: '' },
    { name: opts.backLabel, href: opts.backHref },
    { name: opts.name, href: opts.canonical },
  ]);
  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: opts.title,
    numberOfItems: opts.jobs.length,
    itemListElement: opts.jobs.map((job, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/${jobUrl(job)}`,
      name: job.title,
    })),
  };
  const body = `
  <div class="container">
    ${bc.html}
    <header class="page-head">
      <h1>${esc(opts.h1)}</h1>
      <p>${esc(opts.intro)}</p>
    </header>
    <div class="job-grid">
      ${opts.jobs.map(jobCard).join('')}
    </div>
  </div>`;
  return layout(
    {
      title: opts.title,
      description: opts.description,
      canonical: opts.canonical,
      active: opts.kind === 'category' ? 'categories' : 'locations',
      extraLd: [itemListLd, bc.ld],
    },
    body
  );
}

function buildIndexLanding(opts) {
  // Directory page listing all categories or locations.
  const bc = breadcrumbs([
    { name: 'Home', href: '' },
    { name: opts.name, href: opts.canonical },
  ]);
  const cards = opts.entries
    .map(
      (e) => `
        <a class="tile" href="/${e.href}">
          <span class="tile__name">${esc(e.name)}</span>
          <span class="tile__count">${e.count} job${e.count === 1 ? '' : 's'}</span>
        </a>`
    )
    .join('');
  const body = `
  <div class="container">
    ${bc.html}
    <header class="page-head">
      <h1>${esc(opts.h1)}</h1>
      <p>${esc(opts.intro)}</p>
    </header>
    <div class="tile-grid">
      ${cards}
    </div>
  </div>`;
  return layout(
    {
      title: opts.title,
      description: opts.description,
      canonical: opts.canonical,
      active: opts.active,
      extraLd: [bc.ld],
    },
    body
  );
}

function buildAbout() {
  const bc = breadcrumbs([{ name: 'Home', href: '' }, { name: 'About', href: 'about/' }]);
  const body = `
  <div class="container">
    ${bc.html}
    <header class="page-head">
      <h1>About ${esc(SITE_NAME)}</h1>
      <p>${esc(SITE_TAGLINE)} — built for the people who build the Gulf’s biggest events.</p>
    </header>
    <div class="prose prose--wide">
      <p>${esc(SITE_NAME)} is the Gulf region’s dedicated job board for the events and
      exhibitions industry. From flagship trade shows at the Dubai World Trade Centre and ADNEC
      to conferences, festivals and brand activations across Riyadh, Doha, Kuwait City, Manama
      and Muscat, we connect specialist event talent with the organisations that need them.</p>

      <h2>What we cover</h2>
      <p>We list roles across the full event lifecycle — event management, exhibition and stand
      build, technical production and AV, event sales and sponsorship, marketing, operations and
      logistics, registration, and guest services — in every GCC market: the United Arab
      Emirates, Saudi Arabia, Qatar, Kuwait, Bahrain and Oman.</p>

      <h2>Why we exist</h2>
      <p>The Gulf’s events economy is growing fast, but event professionals were scattered across
      generic job boards. We bring every event and exhibition opportunity into one focused place,
      so candidates find relevant roles faster and employers reach a specialist audience.</p>

      <h2>Powered by ${esc(POWERED_BY)}</h2>
      <p>${esc(SITE_NAME)} is powered by <a href="${esc(POWERED_BY_URL)}" rel="noopener">${esc(POWERED_BY)}</a>,
      bringing recruitment and business expertise to the region’s events sector.</p>

      <p><a class="btn btn--primary" href="/post-a-job/">Post a job</a>
      <a class="btn btn--ghost" href="/">Browse jobs</a></p>
    </div>
  </div>`;
  return layout(
    {
      title: `About Us | ${SITE_NAME}`,
      description: `About ${SITE_NAME}, the Gulf region's dedicated job board for event and exhibition careers, powered by ${POWERED_BY}.`,
      canonical: 'about/',
      active: 'about',
      extraLd: [bc.ld],
    },
    body
  );
}

function buildPostAJob() {
  const bc = breadcrumbs([{ name: 'Home', href: '' }, { name: 'Post a Job', href: 'post-a-job/' }]);
  const subject = encodeURIComponent('New job posting — Gulf Events Jobs');
  const bodyTpl = encodeURIComponent(
    'Please post the following event / exhibition role:\n\n' +
      'Job title:\nCompany:\nLocation (city, country):\nCategory:\nEmployment type:\nSalary range:\nSummary:\nKey responsibilities:\nRequirements:\nApplication email / link:\nClosing date:\n'
  );
  const body = `
  <div class="container">
    ${bc.html}
    <header class="page-head">
      <h1>Post an event or exhibition job</h1>
      <p>Reach thousands of specialist event professionals across the Gulf. It only takes a few minutes.</p>
    </header>
    <div class="post-grid">
      <div class="prose">
        <h2>How it works</h2>
        <ol>
          <li>Send us your role details using the form or by email.</li>
          <li>We optimise and publish your listing — with its own SEO-friendly page and Google&nbsp;Jobs structured data.</li>
          <li>Candidates apply and reach you directly.</li>
        </ol>
        <h2>Why ${esc(SITE_NAME)}</h2>
        <ul>
          <li>A specialist audience of Gulf event and exhibition professionals</li>
          <li>Every listing is optimised to appear in Google&nbsp;for&nbsp;Jobs</li>
          <li>Coverage across the UAE, Saudi Arabia, Qatar, Kuwait, Bahrain and Oman</li>
          <li>Powered by ${esc(POWERED_BY)}</li>
        </ul>
      </div>
      <aside class="post-form-card">
        <h2>Submit your role</h2>
        <form class="post-form" action="https://formsubmit.co/${esc(CONTACT_EMAIL)}" method="POST">
          <p class="form-note">Fields marked * are required.</p>
          <label>Job title *<input type="text" name="job_title" required /></label>
          <label>Company *<input type="text" name="company" required /></label>
          <label>Location (city, country) *<input type="text" name="location" required /></label>
          <label>Category
            <select name="category">
              <option>Event Management</option>
              <option>Exhibition &amp; Stands</option>
              <option>Production &amp; AV</option>
              <option>Sales &amp; Sponsorship</option>
              <option>Marketing</option>
              <option>Registration &amp; Operations</option>
              <option>Hospitality &amp; Guest Services</option>
            </select>
          </label>
          <label>Your email *<input type="email" name="email" required /></label>
          <label>Role details<textarea name="details" rows="4" placeholder="Summary, responsibilities, requirements, salary…"></textarea></label>
          <button class="btn btn--primary btn--block" type="submit">Send job for review</button>
          <p class="form-note">Prefer email? Write to
            <a href="mailto:${esc(CONTACT_EMAIL)}?subject=${subject}&body=${bodyTpl}">${esc(CONTACT_EMAIL)}</a>.</p>
        </form>
      </aside>
    </div>
  </div>`;
  return layout(
    {
      title: `Post a Job | ${SITE_NAME}`,
      description: `Advertise your event or exhibition vacancy to specialist candidates across the Gulf. Every listing is optimised for Google for Jobs. Powered by ${POWERED_BY}.`,
      canonical: 'post-a-job/',
      active: 'post',
      extraLd: [bc.ld],
    },
    body
  );
}

function build404() {
  const body = `
  <div class="container error-page">
    <p class="error-code">404</p>
    <h1>Page not found</h1>
    <p>The page you were looking for may have expired or moved.</p>
    <p><a class="btn btn--primary" href="/">Browse all jobs</a></p>
  </div>`;
  return layout(
    { title: `Page not found | ${SITE_NAME}`, description: 'Page not found.', canonical: '404/', active: '' },
    body
  );
}

/* ------------------------------- sitemap -------------------------------- */
function buildSitemap(urls) {
  const body = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${SITE_URL}/${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>\n`;
}

/* -------------------------------- main ---------------------------------- */
function main() {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'jobs.json'), 'utf8'));
  const jobs = raw.jobs
    .map((j) => ({ ...j, slug: slugify(`${j.title}-${j.city}-${j.id}`) }))
    .sort((a, b) => (a.datePosted < b.datePosted ? 1 : -1));

  const today = jobs.reduce((max, j) => (j.datePosted > max ? j.datePosted : max), jobs[0].datePosted);

  // Aggregate categories and locations.
  const catMap = new Map();
  const locMap = new Map();
  for (const job of jobs) {
    if (!catMap.has(job.category)) catMap.set(job.category, []);
    catMap.get(job.category).push(job);
    if (!locMap.has(job.country)) locMap.set(job.country, []);
    locMap.get(job.country).push(job);
  }
  const categories = [...catMap.entries()]
    .map(([name, list]) => ({ name, slug: slugify(name), count: list.length, jobs: list }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const locations = [...locMap.entries()]
    .map(([name, list]) => ({ name, slug: slugify(name), count: list.length, jobs: list }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const written = [];
  const sitemapUrls = [];

  // Home
  written.push(writePage('index.html', buildHome(jobs, categories, locations)));
  sitemapUrls.push({ loc: '', lastmod: today, changefreq: 'daily', priority: '1.0' });

  // Job pages
  for (const job of jobs) {
    const related = jobs
      .filter((j) => j.id !== job.id && (j.category === job.category || j.country === job.country))
      .slice(0, 3);
    written.push(writePage(`jobs/${job.slug}/index.html`, buildJobPage(job, related)));
    sitemapUrls.push({ loc: jobUrl(job), lastmod: job.datePosted, changefreq: 'weekly', priority: '0.8' });
  }

  // Categories index + pages
  written.push(
    writePage(
      'categories/index.html',
      buildIndexLanding({
        name: 'Categories',
        h1: 'Browse event jobs by category',
        intro: 'Explore event and exhibition roles by specialism across the Gulf region.',
        title: `Event Job Categories | ${SITE_NAME}`,
        description: 'Browse Gulf event and exhibition jobs by category: event management, exhibition & stands, production & AV, sales, marketing, operations and more.',
        canonical: 'categories/',
        active: 'categories',
        entries: categories.map((c) => ({ name: c.name, count: c.count, href: `categories/${c.slug}/` })),
      })
    )
  );
  sitemapUrls.push({ loc: 'categories/', lastmod: today, changefreq: 'weekly', priority: '0.6' });
  for (const c of categories) {
    written.push(
      writePage(
        `categories/${c.slug}/index.html`,
        buildListingLanding({
          kind: 'category',
          name: c.name,
          canonical: `categories/${c.slug}/`,
          backHref: 'categories/',
          backLabel: 'Categories',
          h1: `${c.name} jobs in the Gulf`,
          intro: `${c.count} ${c.name.toLowerCase()} ${c.count === 1 ? 'role' : 'roles'} across the UAE, Saudi Arabia, Qatar, Kuwait, Bahrain and Oman.`,
          title: `${c.name} Jobs in the Gulf (UAE, Saudi, Qatar) | ${SITE_NAME}`,
          description: `Latest ${c.name.toLowerCase()} jobs across the Gulf region. Apply for event and exhibition ${c.name.toLowerCase()} roles in the UAE, Saudi Arabia, Qatar and the wider GCC.`,
          jobs: c.jobs,
        })
      )
    );
    sitemapUrls.push({ loc: `categories/${c.slug}/`, lastmod: today, changefreq: 'weekly', priority: '0.7' });
  }

  // Locations index + pages
  written.push(
    writePage(
      'locations/index.html',
      buildIndexLanding({
        name: 'Locations',
        h1: 'Browse event jobs by location',
        intro: 'Find event and exhibition jobs in each Gulf market.',
        title: `Event Jobs by Location — UAE, Saudi, Qatar & GCC | ${SITE_NAME}`,
        description: 'Browse event and exhibition jobs by country across the Gulf: United Arab Emirates, Saudi Arabia, Qatar, Kuwait, Bahrain and Oman.',
        canonical: 'locations/',
        active: 'locations',
        entries: locations.map((l) => ({ name: l.name, count: l.count, href: `locations/${l.slug}/` })),
      })
    )
  );
  sitemapUrls.push({ loc: 'locations/', lastmod: today, changefreq: 'weekly', priority: '0.6' });
  for (const l of locations) {
    written.push(
      writePage(
        `locations/${l.slug}/index.html`,
        buildListingLanding({
          kind: 'location',
          name: l.name,
          canonical: `locations/${l.slug}/`,
          backHref: 'locations/',
          backLabel: 'Locations',
          h1: `Event &amp; exhibition jobs in ${l.name}`,
          intro: `${l.count} event and exhibition ${l.count === 1 ? 'role' : 'roles'} in ${l.name}.`,
          title: `Event & Exhibition Jobs in ${l.name} | ${SITE_NAME}`,
          description: `Latest event and exhibition jobs in ${l.name}. Apply for event manager, exhibition, production, AV and event sales roles in ${l.name}.`,
          jobs: l.jobs,
        })
      )
    );
    sitemapUrls.push({ loc: `locations/${l.slug}/`, lastmod: today, changefreq: 'weekly', priority: '0.7' });
  }

  // Static pages
  written.push(writePage('about/index.html', buildAbout()));
  sitemapUrls.push({ loc: 'about/', lastmod: today, changefreq: 'monthly', priority: '0.5' });
  written.push(writePage('post-a-job/index.html', buildPostAJob()));
  sitemapUrls.push({ loc: 'post-a-job/', lastmod: today, changefreq: 'monthly', priority: '0.5' });
  written.push(writePage('404.html', build404()));

  // Sitemap + robots
  written.push(writePage('sitemap.xml', buildSitemap(sitemapUrls)));
  written.push(
    writePage(
      'robots.txt',
      `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
    )
  );

  console.log(`Built ${written.length} files for ${SITE_NAME}`);
  console.log(`  ${jobs.length} jobs, ${categories.length} categories, ${locations.length} locations`);
  console.log(`  Site URL: ${SITE_URL}`);
}

main();
