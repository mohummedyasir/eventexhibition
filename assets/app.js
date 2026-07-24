/* Gulf Events Jobs — client-side search & filtering for the homepage.
   Progressive enhancement: all jobs render server-side; this only filters. */
(function () {
  'use strict';

  var form = document.getElementById('search-form');
  var list = document.getElementById('job-list');
  if (!form || !list) return;

  var q = document.getElementById('q');
  var country = document.getElementById('filter-country');
  var category = document.getElementById('filter-category');
  var count = document.getElementById('results-count');
  var noResults = document.getElementById('no-results');
  var clearBtn = document.getElementById('clear-filters');
  var cards = Array.prototype.slice.call(list.querySelectorAll('.job-card'));

  function apply() {
    var term = (q.value || '').trim().toLowerCase();
    var c = country.value;
    var cat = category.value;
    var shown = 0;

    cards.forEach(function (card) {
      var matchText = !term || card.getAttribute('data-search').indexOf(term) !== -1;
      var matchCountry = !c || card.getAttribute('data-country') === c;
      var matchCat = !cat || card.getAttribute('data-category') === cat;
      var visible = matchText && matchCountry && matchCat;
      card.hidden = !visible;
      if (visible) shown++;
    });

    if (count) count.textContent = shown + (shown === 1 ? ' job' : ' jobs');
    if (noResults) noResults.hidden = shown !== 0;

    // Reflect the query in the URL for shareable/deep-linkable searches.
    var params = new URLSearchParams();
    if (term) params.set('q', q.value.trim());
    if (c) params.set('country', c);
    if (cat) params.set('category', cat);
    var qs = params.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  }

  function hydrateFromUrl() {
    var params = new URLSearchParams(location.search);
    if (params.get('q')) q.value = params.get('q');
    if (params.get('country')) country.value = params.get('country');
    if (params.get('category')) category.value = params.get('category');
    if (params.toString()) apply();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    apply();
    var section = document.getElementById('all-h');
    if (section) section.scrollIntoView({ block: 'start' });
  });
  q.addEventListener('input', apply);
  country.addEventListener('change', apply);
  category.addEventListener('change', apply);
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      q.value = '';
      country.value = '';
      category.value = '';
      apply();
    });
  }

  hydrateFromUrl();
})();
