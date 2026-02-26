/**
 * Lampa Plugin — Rezka Balancer
 * Балансер: https://rezka-ua.pub/
 * Встановлення: вставте URL цього файлу у Lampa → Налаштування → Плагіни
 */

(function () {
    'use strict';

    var BALANCER_URL = 'https://rezka-ua.pub';
    var PLUGIN_NAME  = 'RezkaBalancer';

    // ── Утиліти ──────────────────────────────────────────────────────────────

    function log(msg) {
        console.log('[' + PLUGIN_NAME + '] ' + msg);
    }

    function buildSearchUrl(query) {
        return BALANCER_URL + '/?do=search&subaction=search&q=' + encodeURIComponent(query);
    }

    function buildMovieUrl(path) {
        return path.startsWith('http') ? path : BALANCER_URL + path;
    }

    // ── Парсер відповіді сайту ───────────────────────────────────────────────

    function parseSearchResults(html) {
        var results = [];
        var parser  = new DOMParser();
        var doc     = parser.parseFromString(html, 'text/html');

        doc.querySelectorAll('.b-content__inline_item').forEach(function (el) {
            var linkEl  = el.querySelector('.b-content__inline_item-link a');
            var imgEl   = el.querySelector('img');
            var yearEl  = el.querySelector('.b-content__inline_item-link div');

            if (!linkEl) return;

            results.push({
                title : linkEl.textContent.trim(),
                url   : linkEl.getAttribute('href'),
                poster: imgEl  ? imgEl.getAttribute('src') : '',
                year  : yearEl ? yearEl.textContent.trim() : ''
            });
        });

        return results;
    }

    // ── Запит через Lampa.Reguest (обходить CORS) ────────────────────────────

    function fetchPage(url, callback) {
        Lampa.Reguest.get(
            { url: url, dataType: 'text' },
            function (html) { callback(null, html); },
            function (err)  { callback(err || 'Network error', null); }
        );
    }

    // ── Компонент (сторінка плагіна) ─────────────────────────────────────────

    function RezkaComponent(object) {
        var network = new Lampa.Reguest();
        var scroll  = new Lampa.Scroll({ mask: true, over: true });
        var items   = [];
        var query   = object.query || (object.movie && object.movie.title) || '';

        this.create = function () {
            log('create, query: ' + query);
            this.activity.loader(true);
            this.doSearch(query);
        };

        this.doSearch = function (q) {
            var self = this;
            if (!q) { self.activity.loader(false); self.empty(); return; }

            fetchPage(buildSearchUrl(q), function (err, html) {
                self.activity.loader(false);
                if (err) { Lampa.Noty.show('Помилка завантаження: ' + err); return; }

                var results = parseSearchResults(html);
                if (!results.length) { self.empty(); return; }

                self.buildList(results);
            });
        };

        this.buildList = function (results) {
            var self  = this;
            var elems = Lampa.Template.js('scroll', {});

            results.forEach(function (item) {
                var card = Lampa.Template.js('card', {
                    title      : item.title,
                    release_date: item.year,
                    poster_path: item.poster
                });

                card.on('hover:enter', function () {
                    self.openMovie(item);
                });

                items.push(card);
                scroll.append(card);
            });

            this.render().append(scroll.render());
            scroll.update();
            Lampa.Controller.enable('content');
        };

        this.openMovie = function (item) {
            var url = buildMovieUrl(item.url);
            log('opening: ' + url);

            // Відкриваємо через вбудований браузер Lampa
            Lampa.Activity.push({
                url     : url,
                title   : item.title,
                component: 'iframe',
                poster  : item.poster
            });
        };

        this.empty = function () {
            var empty = Lampa.Template.js('list_empty', {});
            this.render().append(empty);
        };

        this.render = function () {
            if (!this._render) this._render = $('<div class="rezka-balancer"></div>');
            return this._render;
        };

        this.pause  = function () {};
        this.resume = function () {};

        this.back = function () {
            Lampa.Activity.backward();
        };

        this.destroy = function () {
            network.clear();
            scroll.destroy();
            items.forEach(function (c) { c.destroy(); });
        };
    }

    // ── Кнопка в картці фільму ───────────────────────────────────────────────

    function addCardButton() {
        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'complite') return;

            var movie = e.object.activity.movie;
            var btn   = $([
                '<div class="full-start__button selector" data-rezka="1">',
                '  <svg viewBox="0 0 24 24" width="22" height="22">',
                '    <path fill="currentColor" d="M8 5v14l11-7z"/>',
                '  </svg>',
                '  <span>Rezka</span>',
                '</div>'
            ].join(''));

            btn.on('hover:enter', function () {
                var title = (movie.title || movie.name || '').replace(/\s*\(\d{4}\).*$/, '');
                Lampa.Activity.push({
                    title    : 'Пошук: ' + title,
                    component: PLUGIN_NAME,
                    query    : title,
                    movie    : movie
                });
            });

            e.object.render().find('.full-start__buttons').append(btn);
        });
    }

    // ── Пункт меню (опційно) ─────────────────────────────────────────────────

    function addMenuItem() {
        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name !== 'more') return;

            var item = $('<div class="settings-param selector"><div class="settings-param__name">Rezka Search</div></div>');
            item.on('hover:enter', function () {
                Lampa.Activity.push({
                    title    : 'Rezka',
                    component: PLUGIN_NAME,
                    query    : ''
                });
            });

            e.body.find('.settings-param').last().after(item);
        });
    }

    // ── Реєстрація ───────────────────────────────────────────────────────────

    function init() {
        if (window[PLUGIN_NAME + '_loaded']) return;
        window[PLUGIN_NAME + '_loaded'] = true;

        log('init');

        Lampa.Component.add(PLUGIN_NAME, RezkaComponent);
        addCardButton();
        addMenuItem();

        log('registered OK');
    }

    // Lampa може завантажитися пізніше
    if (window.Lampa) {
        init();
    } else {
        document.addEventListener('lampa:ready', init);
    }

})();
