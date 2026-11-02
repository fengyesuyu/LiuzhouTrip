/* ==============================================================
   柳州 48 小时打卡页 · 交互
   · 根据 data.js 渲染两天时间轴
   · 地图点位全部「打开页面时实时查询」，不预存坐标
   ============================================================== */

(function () {
  'use strict';

  var SHOPS = window.LZ_SHOPS || [];
  var META = window.LZ_META || { days: [] };
  var CFG = window.LZ_MAP || {};

  /* ---------------- 小工具 ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  function mk(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toMin(hhmm) {
    var p = String(hhmm).split(':');
    if (p.length !== 2) return null;
    var h = parseInt(p[0], 10), m = parseInt(p[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }

  /* 营业状态：支持跨夜（16:00-02:00） */
  function openState(s) {
    var o = toMin(s.open), c = toMin(s.close);
    if (o == null || c == null) return { k: 'na', txt: '时段未核实' };
    var n = new Date();
    var m = n.getHours() * 60 + n.getMinutes();
    var on = (c > o) ? (m >= o && m < c) : (m >= o || m < c);
    return {
      k: on ? 'on' : 'off',
      txt: (on ? '营业中' : '已打烊') + ' · ' + s.open + '–' + s.close
    };
  }

  /* ---------------- 渲染 ---------------- */
  var stage = $('#route');

  META.days.forEach(function (d) {
    var sec = mk('section', 'daysec');
    sec.id = d.key;
    sec.setAttribute('data-day', String(d.id));

    var head = mk('div', 'dayhead ' + d.key);
    head.innerHTML =
      '<div class="dl">' + esc(d.label) + '</div>' +
      '<h3>' + esc(d.theme) + '</h3>' +
      '<p>' + esc(d.brief) + '</p>' +
      '<div class="area">📍 ' + esc(d.area) + '</div>';
    sec.appendChild(head);

    SHOPS.filter(function (s) { return s.day === d.id; })
      .sort(function (a, b) { return a.time.localeCompare(b.time); })
      .forEach(function (s) { sec.appendChild(card(s)); });

    stage.appendChild(sec);
  });

  function card(s) {
    var st = openState(s);
    var cls = s.day === 2 ? 'd2c' : '';
    var el = mk('article', 'card ' + cls);
    el.setAttribute('data-id', s.id);
    el.setAttribute('data-day', String(s.day));

    var flagCls = s.conf === '高' ? 'c-high' : (s.conf === '中' ? 'c-mid' : 'c-low');
    var flagTxt = s.conf === '高' ? '视频点名' : (s.conf === '中' ? '需选分店' : '视频未点名');

    var h = '';
    h += '<div class="no">' + String(s.no).padStart(2, '0') + '</div>';
    h += '<div class="card-top">';
    h +=   '<div class="when"><b>' + esc(s.time) + '</b><span>第 ' + s.no + ' 站</span></div>';
    h +=   '<div class="name">';
    h +=     '<h4>' + esc(s.name) + '<i class="flag ' + flagCls + '">' + flagTxt + '</i></h4>';
    h +=     '<div class="sub">' + esc(s.sub) + '</div>';
    h +=   '</div>';
    h += '</div>';

    if (s.tag) h += '<p class="tagline">' + esc(s.tag) + '</p>';

    h += '<div class="facts">';
    h +=   '<div><span class="k">地址</span><span>' + esc(s.addr) + '</span></div>';
    h +=   '<div><span class="k">时段</span><span class="hours"><i class="dot ' + st.k + '"></i>' + esc(st.txt) + '</span></div>';
    h += '</div>';

    if (s.note) h += '<p class="note">' + esc(s.note) + '</p>';
    if (s.leg)  h += '<p class="leg">' + esc(s.leg) + '</p>';

    el.innerHTML = h;

    /* 按钮 */
    var acts = mk('div', 'acts');
    var nav = mk('a', 'btn hi', '🧭 导航');
    nav.target = '_blank';
    nav.rel = 'noopener';
    nav.href = searchURL(s);
    var cp = mk('button', 'btn', '📋 复制');
    cp.type = 'button';
    cp.addEventListener('click', function (e) {
      e.stopPropagation();
      copy(s.name + '　' + s.addr, function (ok) {
        cp.textContent = ok ? '✅ 已复制' : '❌ 失败';
        setTimeout(function () { cp.textContent = '📋 复制'; }, 1500);
      });
    });
    acts.appendChild(nav);
    acts.appendChild(cp);
    el.appendChild(acts);

    var loc = mk('div', 'locate', '定位状态：进入页面后自动查询…');
    el.appendChild(loc);

    el.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) return;
      focusShop(s, false);
    });

    s.el = el;
    s.locEl = loc;
    return el;
  }

  function searchURL(s) {
    return 'https://uri.amap.com/search?keyword=' + encodeURIComponent(s.kw)
      + '&city=' + encodeURIComponent(s.city || '柳州')
      + '&view=map&callnative=1&src=lz-48h';
  }

  function markerURL(s) {
    if (!s.info) return searchURL(s);
    return 'https://uri.amap.com/marker?position=' + s.info.lng + ',' + s.info.lat
      + '&name=' + encodeURIComponent(s.name) + '&src=lz-48h';
  }

  function copy(txt, done) {
    function legacy() {
      var ta = document.createElement('textarea');
      ta.value = txt;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      done(ok);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(txt).then(function () { done(true); }, legacy);
    } else legacy();
  }

  /* ---------------- 天数切换 ---------------- */
  var tabs = $$('.tab[data-day]');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      tabs.forEach(function (x) { x.classList.remove('on'); });
      t.classList.add('on');
      var d = t.getAttribute('data-day');
      $$('.daysec').forEach(function (sec) {
        sec.hidden = !(d === 'all' || sec.getAttribute('data-day') === d);
      });
      mapFilter(d);
      if (d !== 'all') {
        var target = document.getElementById('d' + d);
        if (target) window.scrollTo({ top: target.offsetTop - 56, behavior: 'smooth' });
      }
    });
  });

  /* ---------------- 地图 ---------------- */
  var hasMap = false, map = null, layerGroup = null, tileLayer = null;
  var DCOLOR = { 1: '#c2410c', 2: '#0f766e' };
  var stat = $('#mapstat');
  var mapFilterKey = 'all';

  function initMap() {
    var box = $('#map');
    if (!box) return;
    if (!window.L) {
      box.innerHTML = '<div class="mfail">地图组件没加载成功<br>'
        + '确认 assets/vendor/leaflet/ 已经跟页面一起上传</div>';
      if (stat) stat.textContent = '地图组件缺失，卡片上的「导航」按钮照常能用。';
      return;
    }
    var TILES = {
      road: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
      sat: 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}'
    };

    map = L.map('map', {
      center: CFG.center || [24.316, 109.414],
      zoom: CFG.zoom || 12,
      minZoom: 9,
      scrollWheelZoom: !L.Browser.mobile,
      attributionControl: true
    });

    function setTile(k) {
      if (tileLayer) map.removeLayer(tileLayer);
      tileLayer = L.tileLayer(TILES[k] || TILES.road, {
        subdomains: '1234', maxZoom: 18, attribution: '底图 &copy; 高德'
      }).addTo(map);
    }
    setTile(CFG.tile);

    var terr = 0;
    map.on('tileerror', function () {
      terr++;
      if (terr === 4 && stat) {
        stat.innerHTML = '<b style="color:#b91c1c">底图瓦片加载失败</b> —— 检查网络，或这台设备限制了外网访问。卡片不受影响。';
      }
    });

    L.control.scale({ imperial: false, maxWidth: 100 }).addTo(map);
    layerGroup = L.layerGroup().addTo(map);
    hasMap = true;
  }

  function icon(s, on) {
    return L.divIcon({
      className: '',
      html: '<div class="mpin' + (on ? ' on' : '') + '" style="background:' + (DCOLOR[s.day] || '#c2410c') + '">'
            + '<i>' + s.no + '</i></div>',
      iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -26]
    });
  }

  function popup(s) {
    var st = openState(s);
    var h = '<div class="mpop"><div class="mt">' + esc(s.name) + '</div>';
    h += '<div class="ma">' + esc(s.info.addr || s.addr) + '</div>';
    h += '<div class="ma">' + esc(s.open ? (s.open + '–' + s.close) : '时段未核实') + ' · ' + esc(st.txt.split(' · ')[0]) + '</div>';
    h += '<a class="mk" href="' + markerURL(s) + '" target="_blank" rel="noopener">🧭 导航到这里</a></div>';
    return h;
  }

  function addPin(s) {
    if (!hasMap || !s.info) return;
    s.marker = L.marker([s.info.lat, s.info.lng], { icon: icon(s, false), title: s.name });
    s.marker.bindPopup(popup(s), { maxWidth: 250 });
    s.marker.on('click', function () {
      highlight(s);
      s.marker.setIcon(icon(s, true));
    });
    s.marker.on('popupclose', function () { s.marker.setIcon(icon(s, false)); });
    if (visible(s)) s.marker.addTo(layerGroup);
  }

  function visible(s) {
    return mapFilterKey === 'all' || String(s.day) === mapFilterKey;
  }

  function mapFilter(key) {
    mapFilterKey = key;
    if (!hasMap) return;
    SHOPS.forEach(function (s) {
      if (!s.marker) return;
      var want = visible(s);
      var has = layerGroup.hasLayer(s.marker);
      if (want && !has) s.marker.addTo(layerGroup);
      if (!want && has) layerGroup.removeLayer(s.marker);
    });
    fit();
  }

  function fit() {
    if (!hasMap) return;
    var pts = SHOPS.filter(function (s) { return s.info && visible(s); })
      .map(function (s) { return [s.info.lat, s.info.lng]; });
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(0.14));
  }

  var hl = null;
  function highlight(s) {
    if (hl && hl !== s.el) hl.classList.remove('hl');
    s.el.classList.add('hl');
    hl = s.el;
  }

  function focusShop(s, fromMap) {
    if (!hasMap || !s.info) {
      if (!s.info) s.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    map.flyTo([s.info.lat, s.info.lng], Math.max(map.getZoom(), 15), { duration: .6 });
    setTimeout(function () {
      s.marker.openPopup();
      s.marker.setIcon(icon(s, true));
    }, 380);
    highlight(s);
    if (!fromMap) {
      var y = s.el.getBoundingClientRect().top + window.pageYOffset - 120;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  /* ---------------- 实时地理编码 ---------------- */
  var AMAP_ERR = {
    '10001': 'Key 无效',
    '10003': '今日配额用完',
    '10004': '请求过于频繁',
    '10008': 'IP 白名单挡住了（要留空）',
    '10009': 'Key 类型不对（要选 Web 服务）',
    '10012': '没开通「搜索POI」权限',
    '10021': 'QPS 超限，稍后自动重试'
  };
  var FATAL = { '10001': 1, '10008': 1, '10009': 1, '10012': 1 };
  var THROTTLE = { '10021': 1, '10004': 1 };

  function configured() {
    if (CFG.provider === 'amap') return !!CFG.amapKey;
    if (CFG.provider === 'tencent') return !!CFG.tencentKey;
    return false;
  }

  function geocode(s, cb) {
    var manual = CFG.pins && CFG.pins[s.kw];
    if (manual) {
      var p = String(manual).split(',');
      if (p.length === 2) {
        return cb({ ok: true, lng: parseFloat(p[0]), lat: parseFloat(p[1]), addr: '手动坐标', src: '手动' });
      }
    }
    if (CFG.provider === 'amap' && CFG.amapKey) return geocodeAmap(s, cb, 0);
    cb({ ok: false, msg: '未配置 Key' });
  }

  function geocodeAmap(s, cb, retry) {
    var url = 'https://restapi.amap.com/v3/place/text?key=' + encodeURIComponent(CFG.amapKey)
      + '&keywords=' + encodeURIComponent(s.kw)
      + '&city=' + encodeURIComponent(s.city || '柳州')
      + '&citylimit=true&offset=1&page=1&extensions=base';
    var to = setTimeout(function () { cb({ ok: false, msg: '查询超时' }); }, 9000);

    fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      clearTimeout(to);
      if (j && j.status === '1' && j.pois && j.pois.length) {
        var poi = j.pois[0];
        var xy = String(poi.location || '').split(',');
        if (xy.length === 2) {
          return cb({
            ok: true, lng: parseFloat(xy[0]), lat: parseFloat(xy[1]),
            addr: (poi.name || '') + (poi.address ? ' · ' + poi.address : ''),
            src: '高德'
          });
        }
      }
      var code = j && j.infocode ? String(j.infocode) : '';
      if (THROTTLE[code] && retry < 2) {
        return setTimeout(function () { geocodeAmap(s, cb, retry + 1); }, 1200);
      }
      cb({ ok: false, msg: AMAP_ERR[code] || (j && j.info) || '地图查不到这家', fatal: !!FATAL[code] });
    }).catch(function () {
      clearTimeout(to);
      cb({ ok: false, msg: '请求失败（网络 / Key 白名单）' });
    });
  }

  /* 批量定位：串行 + 间隔，避免 QPS 触发 */
  var fatalHit = false;
  function batch(list) {
    var i = 0;
    (function next() {
      if (i >= list.length) { fit(); summary(); return; }
      var s = list[i++];
      if (fatalHit) {
        s.locEl.className = 'locate no';
        s.locEl.textContent = '⚠️ 未定位：Key 配置有问题，见页面底部说明';
        return next();
      }
      s.locEl.className = 'locate';
      s.locEl.textContent = '定位中…';
      geocode(s, function (r) {
        if (r.ok) {
          s.info = r;
          addPin(s);
          s.locEl.className = 'locate yes';
          s.locEl.textContent = '✅ 已定位 · ' + (r.addr || '');
        } else {
          if (r.fatal) fatalHit = true;
          s.locEl.className = 'locate no';
          s.locEl.textContent = '⚠️ 未定位：' + r.msg + '　可点「🧭 导航」直接搜店名';
        }
        setTimeout(next, 360);
      });
    })();
  }

  function summary() {
    if (!stat) return;
    var ok = SHOPS.filter(function (s) { return s.info; }).length;
    if (!hasMap) return;
    stat.innerHTML = '<b>' + ok + '/' + SHOPS.length + '</b> 个点已定位'
      + '（坐标是打开页面时向地图服务实时查询的，本页不存坐标）。'
      + (ok < SHOPS.length ? ' 没定位上的那几家，点卡片里的「🧭 导航」直接用高德搜店名即可。' : '');
  }

  /* ---------------- 地图工具条 ---------------- */
  $$('.mf').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.mf').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      mapFilter(b.getAttribute('data-f'));
    });
  });

  var btnFit = $('#btnFit');
  if (btnFit) btnFit.addEventListener('click', function () { fit(); });

  var btnSat = $('#btnSat');
  if (btnSat) btnSat.addEventListener('click', function () {
    if (!hasMap) return;
    var sat = btnSat.getAttribute('data-sat') === '1';
    btnSat.setAttribute('data-sat', sat ? '0' : '1');
    btnSat.textContent = sat ? '卫星' : '路网';
    var TILES = {
      road: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
      sat: 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}'
    };
    if (tileLayer) map.removeLayer(tileLayer);
    tileLayer = L.tileLayer(TILES[sat ? 'road' : 'sat'], {
      subdomains: '1234', maxZoom: 18, attribution: '底图 &copy; 高德'
    }).addTo(map);
  });

  var btnBig = $('#btnBig');
  if (btnBig) btnBig.addEventListener('click', function () {
    var box = $('#map');
    var big = box.classList.toggle('big');
    btnBig.textContent = big ? '还原' : '放大';
    setTimeout(function () { if (hasMap) map.invalidateSize(); }, 300);
  });

  /* ---------------- 现在开着几家 ---------------- */
  function openNow() {
    var el = $('#openNow');
    if (!el) return;
    var on = SHOPS.filter(function (s) { return openState(s).k === 'on'; });
    var off = SHOPS.filter(function (s) { return openState(s).k === 'off'; });
    var na = SHOPS.filter(function (s) { return openState(s).k === 'na'; });
    var txt = '按你打开页面的这个时间（' + new Date().toTimeString().slice(0, 5) + '）：'
      + (on.length ? '<b>' + on.length + ' 家正在营业</b> —— ' + on.map(function (s) { return s.name; }).join('、')
                   : '<b>现在一家都没开</b>');
    if (off.length) txt += '。已打烊 ' + off.length + ' 家，按时间轴来。';
    if (na.length) txt += ' 另有 ' + na.length + ' 家时段未核实。';
    el.innerHTML = txt;
  }

  /* ---------------- 启动 ---------------- */
  initMap();
  openNow();
  setInterval(openNow, 60000);

  if (location.protocol === 'file:') {
    /* 双击打开本地文件时，浏览器会拦截 file:// → https 的跨域请求 */
    if (stat) {
      stat.innerHTML = '<b>当前是本地文件方式打开（file://）</b>，浏览器会拦截实时定位请求，所以没有点位。'
        + '把整个 <code>liuzhou/</code> 目录用任意静态服务器跑起来（或部署上服务器）再打开，16 个点就会自动标上。'
        + '这段时间卡片上的「🧭 导航」按钮照常能用。';
    }
    $$('.locate').forEach(function (l) {
      l.className = 'locate no';
      l.textContent = '本地文件打开无法实时定位　点「🧭 导航」直接用高德搜店名';
    });
  } else if (!configured()) {
    if (stat) stat.innerHTML = '地图底图可以看，但还没配置 Key，所以没有点位。'
      + '在 <code>assets/config.js</code> 里填上高德 Key 就行。';
    $$('.locate').forEach(function (l) { l.textContent = '定位状态：未配置地图 Key'; });
  } else {
    batch(SHOPS.slice());
  }
})();
