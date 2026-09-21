(function () {
  var d = document, root = d.documentElement;

  /* трафарет сетки */
  if (root.classList.contains('show-grid')) {
    var o = d.createElement('div');
    o.className = 'grid-overlay';
    o.innerHTML = '<div class="wrap"><div class="grid">' + new Array(13).join('<i></i>') + '</div></div>';
    d.body.appendChild(o);
  }

  /* открыто или закрыто — по московскому времени; подпись может стоять в нескольких местах */
  var statuses = d.querySelectorAll('[data-status]');
  if (statuses.length) {
    var hours = {1: [600, 1140], 2: [600, 1140], 3: [600, 1140], 4: [600, 1140], 5: [600, 1140], 6: [660, 1020]};
    var days = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу'];
    var fmt = function (m) { return Math.floor(m / 60) + ':' + ('0' + m % 60).slice(-2); };
    var now = new Date(new Date().toLocaleString('en-US', {timeZone: 'Europe/Moscow'}));
    var day = now.getDay(), min = now.getHours() * 60 + now.getMinutes(), h = hours[day];
    var text = '', open = false;
    if (h && min >= h[0] && min < h[1]) { text = 'Открыто до ' + fmt(h[1]); open = true; }
    else if (h && min < h[0]) { text = 'Откроемся сегодня в ' + fmt(h[0]); }
    else {
      for (var i = 1; i <= 7; i++) {
        var nd = (day + i) % 7;
        if (hours[nd]) { text = 'Закрыто, откроемся ' + (i === 1 ? 'завтра' : days[nd]) + ' в ' + fmt(hours[nd][0]); break; }
      }
    }
    [].forEach.call(statuses, function (s) { s.textContent = text; s.classList.toggle('is-open', open); });
  }

  /* меню в шапке на узких экранах */
  var top = d.querySelector('.top'), burger = d.querySelector('.top__burger');
  function closeMenu() {
    if (!top || !burger) return;
    top.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Открыть меню');
  }
  if (top && burger) {
    burger.addEventListener('click', function () {
      var open = top.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    });
    [].forEach.call(top.querySelectorAll('.top__nav a'), function (a) { a.addEventListener('click', closeMenu); });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && top.classList.contains('is-open')) { closeMenu(); burger.focus(); }
    });
    d.addEventListener('click', function (e) { if (top.classList.contains('is-open') && !top.contains(e.target)) closeMenu(); });
  }

  /* полоса прокрутки */
  var bar = d.querySelector('.progress i');
  var onScroll = function () {
    var max = root.scrollHeight - root.clientHeight;
    if (bar) bar.style.setProperty('--p', max > 0 ? (window.scrollY / max).toFixed(4) : 0);
  };
  addEventListener('scroll', onScroll, {passive: true});
  onScroll();

  /* Текущий раздел: одна активная ссылка, включая конец страницы. */
  var navLinks = [].slice.call(d.querySelectorAll('.top__nav > a[href^="#"]'));
  var navSections = navLinks.map(function(a){ return d.getElementById(a.hash.slice(1)); });
  function updateSection() {
    var line = (top ? top.getBoundingClientRect().height : 72) + 48;
    var current = -1;
    navSections.forEach(function(s,i){if(s && s.getBoundingClientRect().top <= line) current=i;});
    if (window.scrollY > 100 && window.scrollY + innerHeight >= root.scrollHeight - 4) current=navSections.length-1;
    navLinks.forEach(function(a,i){if(i===current) a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
  }
  var spyQueued=false;
  addEventListener('scroll',function(){if(!spyQueued){spyQueued=true;requestAnimationFrame(function(){updateSection();spyQueued=false;});}},{passive:true});
  addEventListener('resize',function(){if(innerWidth>960)closeMenu();updateSection();});
  addEventListener('load',updateSection);
  updateSection();

  /* вкладки: клик и стрелки */
  function tabs(list) {
    if (!list) return;
    var t = [].slice.call(list.querySelectorAll('[role="tab"]'));
    function select(i, focus) {
      t.forEach(function (b, j) {
        var on = i === j;
        b.setAttribute('aria-selected', on);
        b.tabIndex = on ? 0 : -1;
        var p = d.getElementById(b.getAttribute('aria-controls'));
        if (p) p.classList.toggle('is-on', on);
      });
      if (focus) { t[i].focus(); t[i].scrollIntoView({block: 'nearest', inline: 'nearest'}); }
    }
    t.forEach(function (b, i) {
      b.addEventListener('click', function () { select(i); });
      b.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'Home') n = 0;
        if (e.key === 'End') n = t.length - 1;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = (i + 1) % t.length;
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = (i - 1 + t.length) % t.length;
        if (n !== null) { e.preventDefault(); select(n, true); }
      });
    });
  }

  /* что сломалось */
  var narrow = window.matchMedia('(max-width: 960px)');
  [].forEach.call(d.querySelectorAll('[data-finder]'), function (f) {
    tabs(f.querySelector('[role="tablist"]'));
    [].forEach.call(f.querySelectorAll('.finder__panel'), function (p) {
      var btns = [].slice.call(p.querySelectorAll('.finder__symptom'));
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          var target = d.getElementById(b.getAttribute('aria-controls'));
          btns.forEach(function (x) {
            var on = x === b;
            x.setAttribute('aria-pressed', on);
            var a = d.getElementById(x.getAttribute('aria-controls'));
            if (a) a.classList.toggle('is-on', on);
          });
          if (narrow.matches && target) {
            var r = target.getBoundingClientRect();
            if (r.top > innerHeight * .6 || r.top < 0) target.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
          }
        });
      });
    });
  });

  /* раскрывающиеся истории: в группе открыт один пункт */
  [].forEach.call(d.querySelectorAll('[data-acc]'), function (acc) {
    var items = [].slice.call(acc.querySelectorAll('.acc__item'));
    items.forEach(function (it) {
      var btn = it.querySelector('.acc__head');
      if (!btn) return;
      var panel = it.querySelector('.acc__panel');
      if (panel) panel.setAttribute('aria-hidden', 'true');
      btn.addEventListener('click', function () {
        var open = !it.classList.contains('is-open');
        items.forEach(function (o) {
          o.classList.remove('is-open');
          var panel = o.querySelector('.acc__panel'); if (panel) panel.setAttribute('aria-hidden', 'true');
          var b = o.querySelector('.acc__head'); if (b) b.setAttribute('aria-expanded', 'false');
        });
        if (open) { it.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); if (panel) panel.setAttribute('aria-hidden', 'false'); }
      });
    });
  });

  /* появление блоков */
  var reveal = d.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !root.classList.contains('still')) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, {rootMargin: '0px 0px -8% 0px'});
    [].forEach.call(reveal, function (el) { io.observe(el); });
  } else {
    [].forEach.call(reveal, function (el) { el.classList.add('is-in'); });
  }
})();

/* Ровные ряды плашек в соседних колонках («Что ремонтируем», «Цены»): закрытой плашке —
   высота самой высокой в её ряду. На средних ширинах длинные названия переносятся в одной
   колонке и не переносятся в соседней, и ряды съезжали. Колонки остаются независимыми:
   раскрытая история удлиняет только свою колонку. */
(function () {
  var sets = [];
  [['.dirs', '.dir .acc'], ['.prices__cols', '.prices__col .acc']].forEach(function (g) {
    [].forEach.call(document.querySelectorAll(g[0]), function (box) {
      var accs = [].slice.call(box.querySelectorAll(g[1]));
      if (accs.length < 2) return;
      sets.push({ accs: accs, cols: accs.map(function (a) {
        return [].slice.call(a.children).map(function (it) { return it.querySelector('.acc__head'); });
      }) });
    });
  });
  if (!sets.length) return;
  function align() {
    sets.forEach(function (set) {
      set.cols.forEach(function (col) { col.forEach(function (h) { if (h) h.style.minHeight = ''; }); });
      // колонки стоят друг под другом (телефон) — выравнивать нечего
      if (set.accs[0].getBoundingClientRect().left === set.accs[1].getBoundingClientRect().left) return;
      var n = Math.max.apply(null, set.cols.map(function (c) { return c.length; }));
      for (var i = 0; i < n; i++) {
        var row = set.cols.map(function (c) { return c[i]; }).filter(Boolean);
        var m = Math.max.apply(null, row.map(function (h) { return h.getBoundingClientRect().height; }));
        row.forEach(function (h) { h.style.minHeight = m + 'px'; });
      }
    });
  }
  var raf = 0;
  function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(align); }
  align();
  window.addEventListener('resize', schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
})();
