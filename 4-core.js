/* Rádio Mer - núcleo compartilhado (ouvinte e painel) */
(function(){
var TZ = 'America/Fortaleza';
var R = window.Radio = {};
R.api = async function(action, params, token){
  var body = Object.assign({action: action}, params || {});
  if (token) body.token = token;
  var res = await fetch(window.RADIO_API, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify(body), redirect:'follow'});
  var j = await res.json();
  if (!j.ok) throw new Error(j.error || 'Erro');
  return j.data;
};
R.img = function(id, w){ return id ? 'https://lh3.googleusercontent.com/d/' + id + (w ? '=w' + w : '') : ''; };
R.audio = function(id){ return 'https://drive.google.com/uc?export=download&id=' + id; };
R.esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
R.offset = 0; // servidor - cliente
R.now = function(){ return Date.now() + R.offset; };
R.localParts = function(ms){
  var f = new Intl.DateTimeFormat('pt-BR', {timeZone: TZ, hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit', weekday:'short'});
  var p = {}; f.formatToParts(new Date(ms)).forEach(function(x){ p[x.type] = x.value; });
  var wd = {dom:0,seg:1,ter:2,qua:3,qui:4,sex:5,'sáb':6,sab:6}[String(p.weekday).toLowerCase().replace('.','')];
  var h = parseInt(p.hour,10) % 24;
  return {h:h, m:parseInt(p.minute,10), s:parseInt(p.second,10), wd: wd == null ? 0 : wd};
};
function toMin(hhmm){ var a = String(hhmm || '0:0').split(':'); return parseInt(a[0],10) * 60 + parseInt(a[1] || 0,10); }

// Escolhe a lista que toca agora (horários) e monta a sequência com vinhetas.
R.activePlan = function(st, nowMs){
  var lp = R.localParts(nowMs);
  var minNow = lp.h * 60 + lp.m;
  var slot = null;
  (st.schedule || []).forEach(function(sl){
    var days = sl.days && sl.days.length ? sl.days : [0,1,2,3,4,5,6];
    var a = toMin(sl.start), b = toMin(sl.end);
    var inside = a <= b ? (minNow >= a && minNow < b) : (minNow >= a || minNow < b);
    if (inside && days.indexOf(lp.wd) >= 0) slot = sl;
  });
  var plId = slot ? slot.playlistId : st.config.defaultPlaylistId;
  var pl = (st.playlists || []).filter(function(p){ return p.id === plId; })[0];
  if (!pl) pl = (st.playlists || [])[0];
  var tracksById = {}; (st.tracks || []).forEach(function(t){ tracksById[t.id] = t; });
  var music = pl ? (pl.trackIds || []).map(function(id){ return tracksById[id]; }).filter(function(t){ return t && t.duration > 1; }) : [];
  if (!music.length) music = (st.tracks || []).filter(function(t){ return t.kind === 'music' && t.duration > 1; });
  var jingles = (st.tracks || []).filter(function(t){ return t.kind === 'jingle' && t.duration > 1; });
  var every = parseInt(st.config.jingleEvery, 10) || 0;
  var seq = [];
  music.forEach(function(t, i){
    seq.push(t);
    if (every > 0 && jingles.length && (i + 1) % every === 0) seq.push(jingles[Math.floor(i / every) % jingles.length]);
  });
  var total = seq.reduce(function(s, t){ return s + t.duration * 1000; }, 0);
  var anchor = 0;
  if (slot) { anchor = nowMs - (lp.h * 3600 + lp.m * 60 + lp.s) * 1000 - (nowMs % 1000) + toMin(slot.start) * 60000; if (anchor > nowMs) anchor -= 86400000; }
  return {seq: seq, total: total, anchor: anchor, slot: slot, playlist: pl};
};
R.position = function(plan, nowMs){
  if (!plan.seq.length || plan.total <= 0) return null;
  var pos = ((nowMs - plan.anchor) % plan.total + plan.total) % plan.total;
  var acc = 0;
  for (var i = 0; i < plan.seq.length; i++){
    var d = plan.seq[i].duration * 1000;
    if (pos < acc + d) return {index: i, track: plan.seq[i], offset: (pos - acc) / 1000, remaining: (acc + d - pos) / 1000};
    acc += d;
  }
  return {index: 0, track: plan.seq[0], offset: 0, remaining: plan.seq[0].duration};
};
R.upcoming = function(plan, idx, n){
  var out = []; for (var k = 1; k <= n && plan.seq.length; k++) out.push(plan.seq[(idx + k) % plan.seq.length]); return out;
};

// Versículo do dia (lista própria; o painel pode sobrescrever)
R.verses = [
 ['O Senhor é o meu pastor; nada me faltará.','Salmos 23:1'],
 ['Entrai pelas suas portas com ação de graças, e em seus átrios com louvor.','Salmos 100:4'],
 ['Tudo posso naquele que me fortalece.','Filipenses 4:13'],
 ['Lancem sobre ele toda a sua ansiedade, porque ele tem cuidado de vocês.','1 Pedro 5:7'],
 ['O Senhor é a minha luz e a minha salvação; a quem temerei?','Salmos 27:1'],
 ['Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento.','Provérbios 3:5'],
 ['Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito.','João 3:16'],
 ['Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus.','Isaías 41:10'],
 ['Bendize, ó minha alma, ao Senhor, e não te esqueças de nenhum de seus benefícios.','Salmos 103:2'],
 ['Clama a mim, e responder-te-ei, e anunciar-te-ei coisas grandes e ocultas.','Jeremias 33:3'],
 ['O choro pode durar uma noite, mas a alegria vem pela manhã.','Salmos 30:5'],
 ['Se Deus é por nós, quem será contra nós?','Romanos 8:31'],
 ['Eu sou o caminho, a verdade e a vida.','João 14:6'],
 ['Sede fortes e corajosos; não temais, nem vos atemorizeis.','Deuteronômio 31:6'],
 ['A tua palavra é lâmpada para os meus pés e luz para o meu caminho.','Salmos 119:105'],
 ['Alegrai-vos sempre no Senhor; outra vez digo: alegrai-vos.','Filipenses 4:4'],
 ['Buscai primeiro o reino de Deus e a sua justiça, e todas estas coisas vos serão acrescentadas.','Mateus 6:33'],
 ['O Senhor te abençoe e te guarde.','Números 6:24'],
 ['Venham a mim, todos os que estão cansados e sobrecarregados, e eu darei descanso a vocês.','Mateus 11:28'],
 ['Grandes coisas fez o Senhor por nós, e por isso estamos alegres.','Salmos 126:3'],
 ['Cantai ao Senhor um cântico novo.','Salmos 98:1'],
 ['Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.','Salmos 46:1'],
 ['Em tudo dai graças, porque esta é a vontade de Deus em Cristo Jesus para convosco.','1 Tessalonicenses 5:18'],
 ['A fé é a certeza das coisas que se esperam, a prova das coisas que não se vêem.','Hebreus 11:1'],
 ['Ainda que eu ande pelo vale da sombra da morte, não temerei mal algum.','Salmos 23:4'],
 ['Louvai ao Senhor, porque ele é bom, porque a sua misericórdia dura para sempre.','Salmos 136:1'],
 ['Como é bom e agradável os irmãos viverem unidos!','Salmos 133:1'],
 ['O amor é paciente, o amor é bondoso.','1 Coríntios 13:4'],
 ['Tudo o que fizerem, façam de todo o coração, como para o Senhor.','Colossenses 3:23'],
 ['Disse-lhe Jesus: Eu sou a ressurreição e a vida.','João 11:25'],
 ['Pelo que, irmãos, sede firmes e constantes, sempre abundantes na obra do Senhor.','1 Coríntios 15:58']
];
R.verseOfDay = function(cfg){
  if (cfg && cfg.verseText) return {text: cfg.verseText, ref: cfg.verseRef || ''};
  var d = Math.floor(R.now() / 86400000); var v = R.verses[d % R.verses.length];
  return {text: v[0], ref: v[1]};
};
R.fmt = function(s){ s = Math.max(0, Math.round(s)); var m = Math.floor(s / 60), x = s % 60; return m + ':' + (x < 10 ? '0' : '') + x; };
R.cid = (function(){ var k = 'radio_cid'; var v = localStorage.getItem(k); if (!v){ v = Math.random().toString(36).slice(2, 12); localStorage.setItem(k, v); } return v; })();
R.cssVars = function(cfg){
  var c = cfg.color || '#1e6bff';
  document.documentElement.style.setProperty('--accent', c);
  document.documentElement.style.setProperty('--shape', cfg.shape === 'round' ? '50%' : cfg.shape === 'rounded' ? '28px' : '8px');
  var meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = c;
};
})();
