/* Mike Mentor · Missão do dia (v4, 14/11/2026)
   A tela principal vira um passo a passo: abriu, sabe o que fazer agora, quanto tempo, com que material
   e o que conta como feito. Cinco abas: Hoje, Revisão, Plano, Progresso e Mais (ferramentas antigas).

   O dia segue a ordem combinada com Santos:
     1. Aquecimento no Anki (puxar da memória acorda a cabeça)
     2. Português do zero e 3. Matemática do zero (as matérias que ele adia vêm primeiro)
     4. Revisão do dia pelo calendário por incidência (o que mais cai volta mais vezes)
     5. Ficha da vez (fila por % da prova; uma ficha pode levar mais de um dia)
     sábado: + atualidades e, a partir de 05/12, a redação da semana; domingo: pôr em dia + inglês do CFO
     6. Fechamento: erros do dia viram lista para o Anki, e o resumo de amanhã.
   Nada se perde quando ele falta: trilha e fichas andam pela ORDEM (não pela data), revisão atrasada entra
   pela faixa (o que mais cai primeiro) e o domingo é o dia de pôr em dia.

   Dados: missao.json (gerado de cronograma/.gerador_mentor/gerar_missao_json.py) e revisao_v2.json.
   Estado no banco (mentor.config via /proto/estado): mm3_missao (trilha, fichas, dias) e mm3_rev2 (revisão,
   o mesmo do revisao_v2.js). Cronômetro da etapa fica no aparelho (localStorage) e soma minutos em mm3_horas. */
(function(){
'use strict';
if(window.__missao) return;
const VERSAO='20261114q';
const HOJE=window.__HOJE||new Date().toISOString().slice(0,10);
const K='mm3_missao', RK='mm3_rev2', TK='mm_missao_timer';
const TRILHA_ATE='2027-01-02';
const TEC_PASTA='https://www.tecconcursos.com.br/questoes/pastas/7734002';
const TEC_FILTRO='https://www.tecconcursos.com.br/questoes/filtrar';

/* ================================================================ utilidades */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SEM=['dom','seg','ter','qua','qui','sex','sáb'], SEMX=['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
const MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const dt=s=>new Date(s+'T12:00:00');
const isoD=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const add=(s,n)=>{const d=dt(s);d.setDate(d.getDate()+n);return isoD(d);};
const entre=(a,b)=>Math.round((dt(b)-dt(a))/864e5);
const dd=s=>{const d=dt(s);return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;};
const dLonga=s=>{const d=dt(s);return `${SEM[d.getDay()]}, ${d.getDate()} ${MES[d.getMonth()]}`;};
const fmtM=m=>{m=Math.max(0,Math.round(m||0));return m>=60?`${Math.floor(m/60)}h${m%60?String(m%60).padStart(2,'0'):''}`:`${m} min`;};
const mmss=ms=>{const t=Math.max(0,Math.floor(ms/1000));const h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=t%60;return (h?h+':'+String(m).padStart(2,'0'):String(m).padStart(2,'0'))+':'+String(s).padStart(2,'0');};
const cap=t=>t.charAt(0).toUpperCase()+t.slice(1);
const pct=s=>parseFloat(String(s||'0').replace('%','').replace(',','.'))||0;
const pctTxt=n=>(Math.round(n*10)/10).toString().replace('.',',')+'%';
const plural=(n,a,b)=>n===1?a:(b||a+'s');
const semana=s=>dt(s).getDay();
/* ---------- gravação: banco (mentor.config via /proto/estado) + cópia no aparelho ----------
   Cada valor leva _t (hora da gravação). Sem internet (Uber, 4G ruim), fica na fila do aparelho e sobe quando voltar;
   ao abrir, vale a versão mais nova entre a do banco e a do aparelho. Não depende do app antigo estar de pé. */
const API=localStorage.getItem('mm_api')||location.origin;
const SYNC={pend:{},tm:{},falhou:false};
function espelho(k){try{return JSON.parse(localStorage.getItem('mx_'+k)||'null');}catch(_){return null;}}
function lerK(k){const e=(window.__EST||{})[k];return e===undefined?null:e;}
function gravarK(k,v){
  if(v&&typeof v==='object') v._t=Date.now();
  window.__EST=window.__EST||{}; window.__EST[k]=v;
  try{localStorage.setItem('mx_'+k,JSON.stringify({v,sync:0}));}catch(_){}
  SYNC.pend[k]=1; clearTimeout(SYNC.tm[k]); SYNC.tm[k]=setTimeout(()=>enviar(k),500);
}
function tokenAtual(){return sessionStorage.getItem('mm_token')||localStorage.getItem('mm_token')||localStorage.getItem('tipmike_access')||'';}
async function renovar(){
  try{ if(typeof __renovar==='function') return await __renovar(); }catch(_){}
  const mm=!!(sessionStorage.getItem('mm_token')||localStorage.getItem('mm_token')); const rk=mm?'mm_refresh':'tipmike_refresh'; const rt=localStorage.getItem(rk); if(!rt) return false;
  try{const r=await fetch(API+'/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:rt})}); if(!r.ok) return false; const d=await r.json();
    if(d.access_token){localStorage.setItem(mm?'mm_token':'tipmike_access',d.access_token); if(sessionStorage.getItem('mm_token'))sessionStorage.setItem('mm_token',d.access_token); try{__TOKEN=d.access_token;}catch(_){}}
    if(d.refresh_token) localStorage.setItem(rk,d.refresh_token); return true;}catch(_){return false;}
}
async function enviar(k,tentou){
  const v=(window.__EST||{})[k];
  try{
    const r=await fetch(API+'/mentor/proto/estado',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tokenAtual()},body:JSON.stringify({chave:k,valor:v})});
    if(r.status===401&&!tentou&&await renovar()) return enviar(k,true);
    if(!r.ok) throw new Error('HTTP '+r.status);
    delete SYNC.pend[k]; try{const m=espelho(k);if(m&&m.v&&v&&m.v._t===v._t)localStorage.setItem('mx_'+k,JSON.stringify({v,sync:1}));}catch(_){}
    if(SYNC.falhou){SYNC.falhou=false;pintarSync();}
  }catch(e){ if(!SYNC.falhou){SYNC.falhou=true;pintarSync();} clearTimeout(SYNC.tm[k]); SYNC.tm[k]=setTimeout(()=>enviar(k),30000); }
}
/* ao abrir: o que ficou só no aparelho (sem internet) e é mais novo que o do banco volta a subir */
function reconciliar(){
  [K,RK].forEach(k=>{const m=espelho(k); const b=(window.__EST||{})[k];
    if(m&&m.v&&!m.sync&&(!b||!b._t||(m.v._t||0)>(b._t||0))){window.__EST=window.__EST||{};window.__EST[k]=m.v;SYNC.pend[k]=1;enviar(k);}});
}
/* minutos estudados por dia: o mesmo objeto do app antigo (mm3_horas), com teto de 8h por dia no que se mostra */
function horasObj(){let h=null;try{h=horas;}catch(_){} if(!h||typeof h!=='object'){window.__EST=window.__EST||{};h=window.__EST.mm3_horas=window.__EST.mm3_horas||{};} return h;}
function horasVis(){const h=horasObj(),c={};Object.keys(h).forEach(d=>{c[d]=Math.min(+h[d]||0,480);});return c;}
function pintarSync(){const el=document.querySelector('[data-sync]'); if(el) el.hidden=!SYNC.falhou;}
function aviso(t,ic){try{if(typeof toast==='function'){toast(t,ic||'circle-check-big');return;}}catch(_){}console.log(t);}
async function copiar(t){
  try{await navigator.clipboard.writeText(t);aviso('Copiado. Agora é só colar no chat','clipboard-check');return true;}catch(_){}
  const ta=document.createElement('textarea');ta.value=t;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();
  let ok=false;try{ok=document.execCommand('copy');}catch(_){}ta.remove();
  aviso(ok?'Copiado. Agora é só colar no chat':'Não consegui copiar. Segure o texto e copie','clipboard-check');return ok;
}

/* ícones: os do app + alguns que faltavam (lucide) */
const MAIS_IC={
  copy:'<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  route:'<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  dots:'<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  pen:'<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  globe:'<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  lang:'<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  coffee:'<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  cog:'<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  msg:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  calc:'<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
  type:'<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  trash:'<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  sunrise:'<path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/>',
};
function I(n,cls){const p=MAIS_IC[n]||((window.ICONES||(typeof ICONES!=='undefined'?ICONES:{}))[n])||'';
  return `<span class="mx-ic ${cls||''}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg></span>`;}

/* ================================================================ dados */
let MJ=null, RJ=null;
const U=id=>(RJ&&RJ.unidades.find(u=>u.id===id))||null;

/* ================================================================ estado */
function S(){
  const s=Object.assign({},lerK(K)||{});
  s.td=s.td||{};   /* trilha feita: id da sessão -> [dia, acertos, total] (dia null = antes do Mentor novo) */
  s.fd=s.fd||{};   /* fichas feitas: id -> [dia, acertos, total] */
  s.fp=s.fp||{};   /* passos marcados da ficha: id -> {passo:1} */
  s.fm=s.fm||{};   /* minutos gastos na ficha: id -> minutos */
  s.tp=s.tp||{};   /* passos marcados da sessão da trilha: id -> {passo:1} */
  s.d=s.d||{};     /* dias: dia -> {h: horas planejadas, ok:{etapa:1}, m:{etapa:minutos}, fim:1} */
  s.rd=s.rd||{};   /* redação: índice do tema -> dia feito */
  s.cfg=s.cfg||{}; /* h: horas padrão por dia da semana; intro: viu o "como funciona" */
  s.fpg=s.fpg||{}; /* página em que parou a ficha: id -> página */
  return s;
}
function salvar(s){
  const dias=Object.keys(s.d).sort(); dias.slice(0,-90).forEach(k=>delete s.d[k]);
  gravarK(K,s);
}
function dia(s,d){d=d||HOJE;s.d[d]=s.d[d]||{};s.d[d].ok=s.d[d].ok||{};s.d[d].m=s.d[d].m||{};return s.d[d];}

/* primeira vez: a trilha começa de onde o lembrete do chat parou (A2 MMC e MDC + P4 Preposição em 14/11) */
function iniciarEstado(){
  const s=S(); if(s.v) return;
  const ponto={P:'P-P4-1',M:'M-A2-1'};
  ['P','M'].forEach(f=>{const l=MJ.trilha.filter(t=>t.fila===f);const i=l.findIndex(t=>t.id===ponto[f]);
    l.slice(0,Math.max(0,i)).forEach(t=>{s.td[t.id]=[null,null,null];});});
  s.v=1; s.ini=HOJE; salvar(s);
}

/* ================================================================ revisão (mesmas regras do revisao_v2.js) */
const RV={
  e(){const e=Object.assign({},lerK(RK)||{});e.f=e.f||{};e.x=e.x||[];e.ad=e.ad||{};e.ds=e.ds||{};e.tec=e.tec||{};e.er=e.er||[];if(!e.ini)e.ini=HOJE;return e;},
  salvar(e){gravarK(RK,e);},
  chave:it=>it[0]+'|'+it[1]+(it[3]==='x'?'|x':''),
  semDomingo:d=>semana(d)===0?add(d,1):d,
  /* até 02/01 Português e Matemática ficam com a trilha do zero (regra do lembrete): a revisão não repete */
  itens(e){return RJ.agenda.concat(e.x).filter(it=>it[0]>=e.ini&&!(it[0]<=TRILHA_ATE&&/^(Língua Portuguesa|Matemática)/.test((U(it[1])||{}).mat||''))).map(it=>{const k=RV.chave(it);return {k,d:e.ad[k]||it[0],u:it[1],min:it[2],tipo:it[3]};});},
  abertos(e){return RV.itens(e).filter(x=>!e.f[x.k]&&!e.ds[x.k]);},
  /* pendentes até o dia: uma por assunto (a mais recente leva junto as antigas), o que mais cai primeiro */
  pendentes(e,ate){
    const por={};RV.abertos(e).filter(x=>x.d<=(ate||HOJE)).forEach(x=>{(por[x.u]=por[x.u]||[]).push(x);});
    return Object.values(por).map(l=>{l.sort((a,b)=>a.d<b.d?1:-1);return Object.assign({},l[0],{junto:l.slice(1).map(y=>y.k),desde:l[l.length-1].d});})
      .sort((a,b)=>((U(a.u)||{}).f-(U(b.u)||{}).f)||(pct((U(b.u)||{}).pp)-pct((U(a.u)||{}).pp)));
  },
  feitasHoje(e){return Object.entries(e.f).filter(([k,v])=>v[2]===HOJE).map(([k,v])=>({k,u:k.split('|')[1],a:v[0],t:v[1]}));},
  concluir(p,a,t){
    const e=RV.e();const taxa=t?a/t:0;const u=U(p.u)||{};
    [p.k,...p.junto].forEach(k=>{e.f[k]=[a,t,HOJE];});
    const fut=RV.abertos(e).filter(x=>x.u===p.u&&x.d>HOJE).sort((x,y)=>x.d<y.d?-1:1);let msg;
    if(taxa<0.6){const volta=RV.semDomingo(add(HOJE,3));if(!fut.some(x=>x.d<=volta))e.x.push([volta,p.u,20,'x']);
      msg=`${Math.round(taxa*100)}%: ${u.as} volta em 3 dias (${dd(volta)}) para fechar o buraco.`;}
    else if(taxa>=0.85&&fut.length&&entre(HOJE,fut[0].d)<=10){e.ds[fut[0].k]=1;msg=`${Math.round(taxa*100)}%: mandou bem. A revisão de ${dd(fut[0].d)} desse assunto foi dispensada.`;}
    else msg=`${Math.round(taxa*100)}%: segue o calendário${fut.length?`, a próxima é ${dd(fut[0].d)}`:''}.`;
    RV.salvar(e);return msg;
  },
  adiar(p,para){const e=RV.e();const nova=RV.semDomingo(para||add(HOJE,1));[p.k,...p.junto].forEach(k=>{e.ad[k]=nova;});RV.salvar(e);return nova;},
  desfazer(k){const e=RV.e();delete e.f[k];RV.salvar(e);},
  proximos(e,n){const out=[];for(let i=1;i<=n;i++){const d=add(HOJE,i);const l=RV.abertos(e).filter(x=>x.d===d);if(l.length)out.push([d,l]);}return out;},
};

/* erros: uma lista só (a mesma da revisão), cada linha [dia, unidade|null, erro, certo, enviado, rótulo] */
const ER={
  add(uid,rot,erro,certo){const e=RV.e();e.er.push([HOJE,uid||null,erro.slice(0,240),(certo||'').slice(0,240),0,rot||'']);RV.salvar(e);},
  del(i){const e=RV.e();e.er.splice(i,1);RV.salvar(e);},
  rot(x){if(x[5])return x[5];const u=x[1]&&U(x[1]);return u?u.mat+' · '+u.as:'aula do Mentor';},
  pend(){return RV.e().er.map((x,i)=>Object.assign([...x],{i})).filter(x=>!x[4]);},
  texto(){const l=ER.pend();return 'Erros para virar card de Anki ('+l.length+'):\n'+l.map(x=>`- ${dd(x[0])} · ${ER.rot(x)}: ${x[2]}${x[3]?' → certo: '+x[3]:''}`).join('\n')+'\n\nFaz os cards dos erros.';},
  enviados(){const e=RV.e();e.er.forEach(x=>{x[4]=1;});RV.salvar(e);},
};

/* ================================================================ trilha e fichas */
const filaT=f=>MJ.trilha.filter(t=>t.fila===f);
function sessaoDoDia(f,s){
  const l=filaT(f);
  const hoje=l.filter(t=>s.td[t.id]&&s.td[t.id][0]===HOJE);
  const prox=l.find(t=>!s.td[t.id]);
  const adi=((s.d[HOJE]||{}).adi||{})[f];
  /* "Adiantar a próxima": enquanto a próxima não fecha, ela é a sessão do dia */
  const ultimaHoje=(adi!=null&&hoje.length<=adi&&prox)?null:(hoje[hoje.length-1]||null);
  return {feitas:hoje,prox,ultimaHoje};
}
function atrasoTrilha(f,s){const l=filaT(f);return l.filter(t=>!s.td[t.id]&&t.data<HOJE).length;}
function anteriores(t){const l=filaT(t.fila);const i=l.findIndex(x=>x.id===t.id);const cods=[];
  for(let j=i-1;j>=0&&cods.length<2;j--){if(l[j].cod!==t.cod&&!cods.some(c=>c.cod===l[j].cod))cods.push(l[j]);}return cods;}
const filaF=prova=>MJ.fichas.filter(f=>!prova||f.prova===prova);
function fichaDaVez(s){return MJ.fichas.find(f=>!s.fd[f.id])||null;}
function fichasHoje(s){return MJ.fichas.filter(f=>s.fd[f.id]&&s.fd[f.id][0]===HOJE);}
function atrasoFichas(s){return MJ.fichas.filter(f=>f.prova==='Soldado'&&!s.fd[f.id]&&f.fim<HOJE).length;}
function redacaoDaVez(s){if(HOJE<MJ.redacao.inicio)return null;const i=MJ.redacao.temas.findIndex((t,j)=>!s.rd[j]);return i<0?null:{i,tema:MJ.redacao.temas[i]};}

/* ================================================================ o plano do dia */
function horasDoDia(s,d){d=d||HOJE;const x=s.d[d];if(x&&x.h!=null)return x.h;const w=semana(d);const p=(s.cfg.h||{})[w];return p!=null?p:(w===0?2:4);}
const COR={anki:'vi',P:'cy',M:'am',rev:'ro',ficha:'em',atual:'sk',red:'pk',ingles:'sk',atraso:'am',fim:'gr',mistas:'cy',livre:'gr',semana:'vi'};
function plano(s){
  const h=horasDoDia(s), tot=h*60, w=semana(HOJE), dom=w===0, sab=w===6;
  const e=RV.e(), pend=RV.pendentes(e);
  const revMin=pend.reduce((a,x)=>a+x.min,0);
  const ets=[];
  const anki=tot<=120?10:15, fim=5;
  const EC=window.__estudo, mc=EC&&EC.pronto&&EC.modoCards();
  if(mc&&mc!=='fora'){const r=EC.resumoCards()||{rev:0,novos:0,min:0}; ets.push({id:'anki',tipo:'anki',cards:1,min:Math.max(5,Math.min(25,r.min||5)),titulo:'Cards do dia',sub:r.rev+r.novos?`${r.rev} ${plural(r.rev,'revisão','revisões')} · ${r.novos} ${plural(r.novos,'novo')}`:'nada vencido hoje'});}
  else ets.push({id:'anki',tipo:'anki',min:anki,titulo:'Aquecimento no Anki',sub:'os cards vencidos de hoje'});
  const tri=tot<=120?40:45;
  const passoTrilha=f=>{const x=sessaoDoDia(f,s); const t=x.ultimaHoje||x.prox;
    if(t) return {id:f,tipo:'trilha',fila:f,t,min:tri,titulo:(f==='P'?'Português':'Matemática')+' do zero',sub:`${t.cod} · ${t.nome}${t.n>1?` (${t.k}/${t.n})`:''}`};
    return {id:f,tipo:'mistas',fila:f,min:30,titulo:(f==='P'?'Português':'Matemática')+': questões mistas',sub:'a trilha acabou; 20 questões misturadas'};};
  if(dom){
    /* domingo: sem conteúdo novo. Entra só o que ficou para trás, na ordem do que mais pesa, + questões da semana + inglês */
    const feitasRev=RV.feitasHoje(e);
    if(pend.length||feitasRev.length){const esc2=[];let so=0;pend.forEach(p=>{if(!esc2.length||so+p.min<=60){esc2.push(p);so+=p.min;}});
      ets.push({id:'rev',tipo:'rev',min:so+feitasRev.length*20,titulo:'Revisões atrasadas',sub:esc2.length?`${esc2.length} ${plural(esc2.length,'assunto')}${pend.length>esc2.length?` (+${pend.length-esc2.length} na fila)`:''}`:'feitas',rev:esc2,fila:pend.slice(esc2.length)});}
    ['P','M'].forEach(f=>{const x=sessaoDoDia(f,s); if(atrasoTrilha(f,s)||x.feitas.length) ets.push(Object.assign(passoTrilha(f),{titulo:(f==='P'?'Português':'Matemática')+': pôr em dia'}));});
    const fh=fichasHoje(s), fv=fichaDaVez(s);
    if(atrasoFichas(s)||fh.length||(dia(s).m.ficha)){const f=fv||fh[fh.length-1]; if(f) ets.push({id:'ficha',tipo:'ficha',f,min:45,titulo:'Ficha: pôr em dia',sub:f.nome+(s.fpg[f.id]?' · continuar da pág. '+s.fpg[f.id]:'')});}
    const doSemana=assuntosDaSemana(s);
    if(doSemana.length) ets.push({id:'semana',tipo:'semana',min:30,titulo:'Questões da semana',sub:`20 misturadas de ${doSemana.length} ${plural(doSemana.length,'assunto')}`,lista:doSemana});
    if(ets.length===1) ets.push({id:'livre',tipo:'livre',min:0,titulo:'Semana em dia',sub:'descanso merecido'});
    ets.push({id:'ingles',tipo:'ingles',min:30,titulo:'Inglês do CFO',sub:'1 texto curto com as questões'});
    ets.push({id:'fim',tipo:'fim',min:fim,titulo:'Fechamento',sub:'erros para o Anki e a semana que vem'});
    return {h,tot:Math.max(tot,ets.reduce((a2,x)=>a2+x.min,0)),ets,dom,sab};
  }
  ['P','M'].forEach(f=>ets.push(passoTrilha(f)));
  /* teto da revisão no dia; com revisão atrasada, ela ganha mais 30 min e a ficha encolhe (a fila não pode crescer sem fim) */
  const atrasadas=pend.filter(p=>p.d<HOJE).length;
  const tetoRev=(tot<=120?30:tot<=180?35:tot<=240?45:60)+(atrasadas?30:0);
  const escolhidas=[];let soma=0;
  pend.forEach(p=>{if(!escolhidas.length||soma+p.min<=tetoRev){escolhidas.push(p);soma+=p.min;}});
  const feitasRev=RV.feitasHoje(e);
  const minFeitas=feitasRev.reduce((a,x)=>a+((RV.itens(e).find(it=>it.k===x.k)||{}).min||20),0);
  if(escolhidas.length||feitasRev.length) ets.push({id:'rev',tipo:'rev',min:soma+minFeitas,titulo:'Revisão do dia',
    sub:escolhidas.length?`${escolhidas.length} ${plural(escolhidas.length,'assunto')}${pend.length>escolhidas.length?` (+${pend.length-escolhidas.length} na fila)`:''}`:'feita',rev:escolhidas,fila:pend.slice(escolhidas.length)});
  let extras=0;
  if(sab){ets.push({id:'atual',tipo:'atual',min:30,titulo:'Atualidades da semana',sub:'1 fonte, 1 linha por fato'});extras+=30;
    const r=redacaoDaVez(s); const rdHoje=Object.entries(s.rd).find(([j,d])=>d===HOJE);
    if(r||rdHoje){ets.push({id:'red',tipo:'red',min:60,titulo:'Redação da semana',sub:rdHoje?MJ.redacao.temas[+rdHoje[0]]:r.tema,ri:rdHoje?+rdHoje[0]:r.i});extras+=60;}}
  const usado=ets.reduce((a,x)=>a+x.min,0)+fim;
  const fichaMin=Math.max(0,tot-usado);
  const fh=fichasHoje(s); const fv=fichaDaVez(s);
  const f=fv||fh[fh.length-1];
  if(f&&(fichaMin>=25||fh.length||(s.fm[f.id]&&dia(s).m.ficha))) ets.push({id:'ficha',tipo:'ficha',f,min:Math.max(fichaMin,25),titulo:'Ficha da vez',sub:f.nome});
  else if(f) ets.push({id:'ficha',tipo:'ficha',f,min:0,titulo:'Ficha da vez',sub:'sem tempo hoje: ela anda amanhã',semTempo:true});
  const ef=ets.find(x=>x.id==='ficha'); if(ef&&!ef.semTempo&&s.fpg[f.id]) ef.sub=f.nome+' · continuar da pág. '+s.fpg[f.id];
  ets.push({id:'fim',tipo:'fim',min:fim,titulo:'Fechamento',sub:'erros para o Anki e o que vem amanhã'});
  return {h,tot,ets,dom,sab};
}
/* o que passou pela semana (seg a sáb): vira a lista de questões misturadas do domingo */
function assuntosDaSemana(s){
  const ini=add(HOJE,-((semana(HOJE)+6)%7)), fim=HOJE; const out=[]; const vis=new Set();
  const pushU=(nome,mat,uid)=>{if(!vis.has(nome)){vis.add(nome);out.push([nome,mat,uid||null]);}};
  MJ.trilha.forEach(t=>{const v=s.td[t.id];if(v&&v[0]&&v[0]>=ini&&v[0]<=fim)pushU(t.nome,t.fila==='P'?'Português':'Matemática',t.u);});
  MJ.fichas.forEach(f=>{const v=s.fd[f.id];if((v&&v[0]>=ini)||(s.fm[f.id]&&Object.keys(s.d).some(d=>d>=ini&&s.d[d].m&&s.d[d].m.ficha)))if(v||fichaDaVez(s)===f)pushU(f.nome,f.mat,f.u);});
  const e=RV.e(); Object.entries(e.f).forEach(([k,v])=>{if(v[2]>=ini){const u=U(k.split('|')[1]);if(u)pushU(u.as,u.mat,u.id);}});
  return out;
}
function feita(s,et){
  const d=dia(s);
  if(et.tipo==='trilha') return !!(s.td[et.t.id]&&s.td[et.t.id][0]===HOJE);
  if(et.tipo==='rev') return !et.rev.length;
  if(et.tipo==='anki'&&et.cards){const r=window.__estudo.resumoCards();return !!d.ok.anki||(r&&r.rev+r.novos===0&&r.feitos>0);}
  if(et.tipo==='ficha') return !!(d.ok.ficha||(s.fd[et.f.id]&&s.fd[et.f.id][0]===HOJE));
  if(et.tipo==='red') return s.rd[et.ri]===HOJE;
  if(et.tipo==='livre') return true;
  if(et.tipo==='atraso') return !!d.ok.atraso||(!et.rev.length&&!atrasoTrilha('P',s)&&!atrasoTrilha('M',s));
  return !!d.ok[et.id];
}

/* ================================================================ cronômetro da etapa (no aparelho) */
const T={
  ler(){try{const t=JSON.parse(localStorage.getItem(TK)||'null');return t&&t.dia===HOJE?t:null;}catch(_){return null;}},
  gravar(t){try{t?localStorage.setItem(TK,JSON.stringify(t)):localStorage.removeItem(TK);}catch(_){}},
  ms(t){return t?(t.acc+(t.ini?Date.now()-t.ini:0)):0;},
  doId(id){const t=T.ler();return t&&t.id===id?t:null;},
  creditar(t){ /* passa para o banco os minutos inteiros ainda não contados */
    const tot=Math.floor(T.ms(t)/60000), novos=tot-(t.cred||0); if(novos<=0) return;
    t.cred=tot; const s=S(); const d=dia(s); d.m[t.id]=(d.m[t.id]||0)+novos;
    if(t.id==='ficha'&&t.ficha) s.fm[t.ficha]=(s.fm[t.ficha]||0)+novos;
    salvar(s);
    try{ const hh=horasObj(); hh[HOJE]=(hh[HOJE]||0)+novos; window.__EST.mm3_horas=hh;
      fetch(API+'/mentor/proto/evento',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tokenAtual()},body:JSON.stringify({tipo:'horas',dados:{dia:HOJE,minutos:hh[HOJE]}})}).catch(()=>{}); }catch(_){}
  },
  iniciar(et){
    const t0=T.ler(); if(t0&&t0.id!==et.id) T.pausar(true);
    const t=T.doId(et.id)||{id:et.id,dia:HOJE,acc:0,cred:0,alvo:et.min,ficha:et.f?et.f.id:null};
    if(!t.ini){t.ini=Date.now();t.toque=Date.now();} T.gravar(t);
  },
  pausar(silencio){const t=T.ler(); if(!t) return; if(t.ini){t.acc+=Date.now()-t.ini;t.ini=null;} T.creditar(t); T.gravar(t); if(!silencio) aviso('Pausado em '+mmss(T.ms(t)),'pause');},
  zerar(){const t=T.ler(); if(t){if(t.ini){t.acc+=Date.now()-t.ini;t.ini=null;} T.creditar(t);} T.gravar(null);},
  /* a cada segundo: conta os minutos e não deixa o relógio rodar sozinho a noite toda */
  passo(){
    const t=T.ler(); if(!t||!t.ini) return;
    const seg=Date.now()-t.ini, teto=Math.max(90,(t.alvo||45)*2)*60000;
    if(seg>teto){t.acc+=teto;t.ini=null;T.creditar(t);T.gravar(t);aviso('Pausei o cronômetro: passou muito do tempo da etapa. Se ainda está estudando, toque em Continuar.','pause');render();return;}
    if(Math.floor(T.ms(t)/60000)>(t.cred||0)){T.creditar(t);T.gravar(t);}
  },
};

/* ================================================================ desenho */
let aba=(location.hash||'').replace('#m-','')||'hoje'; if(!['hoje','questoes','cards','revisao','plano','progresso','alvo','mais'].includes(aba)) aba='hoje';
let foco=null;            /* etapa aberta no "Agora" */
let abertoRev=null;       /* assunto aberto na revisão */
let planoAberto={};       /* seções abertas no Plano */
let app=null, topo=null, nav=null;

function chip(txt,cor){return `<span class="mx-chip ${cor||''}">${esc(txt)}</span>`;}
function anel(p,tam){const r=26,c=2*Math.PI*r;const v=Math.max(0,Math.min(1,p));
  return `<svg class="mx-anel" viewBox="0 0 64 64" width="${tam||64}" height="${tam||64}" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="mx-anel-f"/><circle cx="32" cy="32" r="${r}" class="mx-anel-v" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-v)}" transform="rotate(-90 32 32)"/></svg>`;}
function barra(p,cor){return `<div class="mx-barra"><i class="${cor||''}" style="width:${Math.round(Math.max(0,Math.min(1,p))*100)}%"></i></div>`;}
const ICON={semana:'layers',anki:'brain',trilha:'play',P:'type',M:'calc',rev:'rotate-ccw',ficha:'file-text',atual:'globe',red:'pen',ingles:'lang',atraso:'calendar-check',fim:'flag',mistas:'circle-help',livre:'coffee'};
const icEt=et=>ICON[et.tipo==='trilha'||et.tipo==='mistas'?et.fila:et.tipo]||'check';
const corEt=et=>COR[et.tipo==='trilha'?et.fila:et.tipo]||'';

function diasProva(){return entre(HOJE,MJ.prova.Soldado);}

function htmlTopo(s){
  const t=T.ler(); const rod=t&&t.ini;
  const hojeMin=horasVis()[HOJE]||0;
  return `<div class="mx-topo-in">
    <button class="mx-marca" data-ir="hoje" aria-label="Hoje"><span class="mx-logo">M</span><span class="mx-marca-t"><b>${esc(cap(dLonga(HOJE)))}</b><i>${diasProva()} dias para a prova</i></span></button>
    <nav class="mx-abas" aria-label="Seções">${ABAS.map(a=>`<button class="mx-aba" data-ir="${a[0]}" aria-current="${abaNav(aba)===a[0]?'page':'false'}">${I(a[2])}<span>${a[1]}</span></button>`).join('')}</nav>
    <span class="mx-sync" data-sync title="Sem conexão: o que você marcar fica guardado no aparelho e sobe quando a internet voltar" ${SYNC.falhou?'':'hidden'}>${I('zap')}offline</span>
    <button class="mx-relogio ${rod?'on':''}" data-acao="relogio" title="${rod?'Pausar':'Tempo estudado hoje'}">${rod?I('pause'):I('clock')}<span data-relogio>${rod?mmss(T.ms(t)):fmtM(hojeMin)}</span></button>
    <button class="mx-cfg" data-ir="mais" aria-label="Ajustes e ferramentas" title="Ajustes e ferramentas" aria-current="${aba==='mais'?'page':'false'}">${I('cog')}</button>
  </div>`;
}
const ABAS=[['hoje','Hoje','home'],['questoes','Questões','circle-help'],['cards','Cards','brain'],['revisao','Revisão','rotate-ccw'],['plano','Plano','route']];
const ABAS_OK=['hoje','questoes','cards','revisao','plano','progresso','alvo','mais'];
const abaNav=a=>a==='progresso'||a==='alvo'?'plano':a;

/* ---------------- HOJE ---------------- */
function vHoje(s){
  const P=plano(s);
  const ets=P.ets.map(et=>Object.assign(et,{ok:feita(s,et)}));
  const tot=ets.filter(e=>e.min>0||e.tipo==='fim');
  const okN=tot.filter(e=>e.ok).length;
  const d=dia(s);
  const gasto=Object.values(d.m).reduce((a,x)=>a+x,0);
  const pMin=Math.min(1,gasto/Math.max(1,P.tot));
  if(!foco||!ets.find(e=>e.id===foco)) foco=(ets.find(e=>!e.ok&&e.tipo!=='livre')||ets[ets.length-1]).id;
  const at=ets.find(e=>e.id===foco);
  const idx=ets.indexOf(at)+1;
  const fechado=!!d.fim;
  const st=statusLinha(s);
  return `
  ${!s.cfg.intro?introHtml():''}
  <section class="mx-hero">
    <div class="mx-hero-anel">${anel(okN/Math.max(1,tot.length),72)}<b>${okN}<i>/${tot.length}</i></b></div>
    <div class="mx-hero-txt">
      <span class="mx-rot">${P.dom?'Domingo · pôr em dia':P.sab?'Sábado':'Missão de hoje'}</span>
      <h1>${fechado?'Missão cumprida':okN===0?'Bora começar':okN>=tot.length-1?'Falta só fechar o dia':'Siga a ordem'}</h1>
      <p class="mx-sub">${okN} de ${tot.length} etapas · ${fmtM(gasto)} cronometrados de ${fmtM(P.tot)}</p>
      ${barra(pMin,'em')}
      ${(()=>{const w=semanaHoras(s);return `<p class="mx-sem">Semana: <b>${fmtM(w.feito)}</b> de ${fmtM(w.meta)}${w.feito>=w.meta?' · meta batida':w.falta>0?` · o domingo fecha a conta`:''}</p>`;})()}
    </div>
  </section>
  <div class="mx-horas" role="group" aria-label="Quanto tempo você tem hoje">
    <span>Hoje eu tenho</span>${[2,3,4,5].map(h=>`<button data-acao="horas" data-h="${h}" aria-pressed="${P.h===h}">${h}h</button>`).join('')}
  </div>
  ${st?`<div class="mx-status ${st.cor}">${I(st.ic)}<span>${st.txt}</span></div>`:''}
  ${fechado?fimDoDiaHtml(s,ets):''}
  <div class="mx-grade"><div>
  <h2 class="mx-h2"><span>Agora</span><i>etapa ${idx} de ${ets.length}</i></h2>
  <article class="mx-foco ${corEt(at)}" data-et="${at.id}">${etapaHtml(s,at,P)}</article></div><aside>
  <h2 class="mx-h2"><span>O dia, nesta ordem</span><i>${fmtM(P.tot)}</i></h2>
  <ol class="mx-linha">${ets.map((et,i)=>`<li class="${et.ok?'ok':''} ${et.id===foco?'atual':''} ${corEt(et)}">
      <button data-foco="${et.id}"><span class="mx-n">${et.ok?I('check'):I(icEt(et))}</span>
        <span class="mx-lt"><b>${esc(et.titulo)}</b><i>${esc(et.sub||'')}</i></span>
        <span class="mx-lm">${et.min?fmtM(et.min):''}${d.m[et.id]?`<em>${fmtM(d.m[et.id])} feitos</em>`:''}</span></button></li>`).join('')}</ol>
  <p class="mx-nota">${I('info')}Faltou um dia? Nada se perde: a trilha e as fichas andam pela ordem, e a revisão atrasada entra pela faixa (o que mais cai primeiro). Domingo é o dia de pôr em dia.</p></aside></div>`;
}
/* a meta é da semana (seg a dom): o que faltou num dia, o domingo fecha */
function semanaHoras(s){
  const ini=add(HOJE,-((semana(HOJE)+6)%7)); let meta=0, feito=0;
  const h=horasVis();
  for(let i=0;i<7;i++){const d=add(ini,i); meta+=horasDoDia(s,d)*60; const x=s.d[d]; const m=x&&x.m?Object.values(x.m).reduce((a,y)=>a+y,0):0; feito+=Math.max(m,h[d]||0);}
  return {meta,feito,falta:Math.max(0,meta-feito)};
}
function statusLinha(s){
  const aP=atrasoTrilha('P',s), aM=atrasoTrilha('M',s), aF=atrasoFichas(s);
  const e=RV.e(); const atr=RV.pendentes(e).filter(x=>x.d<HOJE).length;
  const partes=[];
  if(aP) partes.push(`Português ${aP} ${plural(aP,'sessão','sessões')} atrás`);
  if(aM) partes.push(`Matemática ${aM} atrás`);
  if(aF) partes.push(`${aF} ${plural(aF,'ficha')} atrás do plano`);
  if(atr) partes.push(`${atr} ${plural(atr,'revisão','revisões')} de dias anteriores`);
  if(!partes.length) return {cor:'ok',ic:'shield-check',txt:'Em dia com o plano. Segue o ritmo.'};
  return {cor:'warn',ic:'hourglass',txt:partes.join(' · ')+(semana(HOJE)===0?'. Hoje é o dia de pôr em dia: siga a ordem abaixo.':'. Sem pânico: siga a ordem de hoje, o domingo cobre o resto.')};
}
function introHtml(){
  return `<section class="mx-intro"><b>${I('sparkles')}Como funciona a missão</b>
    <ol><li><b>Abra e siga a ordem.</b> O "Agora" diz o que fazer, por quanto tempo e com que material.</li>
    <li><b>Toda etapa começa puxando da memória</b> (pré-teste ou lembrar sem olhar). Errar ali é parte do método.</li>
    <li><b>No fim, só dois números e uma linha por erro.</b> Os acertos ajustam a revisão; os erros viram card de Anki.</li>
    <li><b>Atrasou? Nada se perde.</b> Trilha e fichas andam pela ordem; o domingo é para pôr em dia.</li></ol>
    <button class="mx-btn" data-acao="intro">${I('check')}Entendi</button></section>`;
}

/* --- a etapa aberta --- */
function relogioHtml(et){
  const t=T.doId(et.id); const rod=t&&t.ini; const ms=T.ms(t);
  const alvo=et.min*60000; const p=alvo?Math.min(1,ms/alvo):0;
  return `<div class="mx-crono ${rod?'on':''}">
    <div class="mx-crono-v"><span data-crono="${et.id}">${mmss(ms)}</span><i>${et.min?'de '+fmtM(et.min):''}</i></div>
    ${barra(p,rod?'em':'')}
    <div class="mx-crono-b">${rod?`<button class="mx-btn sec" data-acao="pausar">${I('pause')}Pausar</button>`:`<button class="mx-btn" data-acao="iniciar">${I('play')}${ms?'Continuar':'Começar'}</button>`}</div>
  </div>`;
}
function passosHtml(lista,marcados,chaveTipo){
  return `<ol class="mx-passos">${lista.map((p,i)=>`<li class="${marcados[p.k]?'ok':''}">
      <button class="mx-chk" data-acao="passo" data-tipo="${chaveTipo}" data-p="${p.k}" aria-pressed="${!!marcados[p.k]}" aria-label="Marcar: ${esc(p.t)}">${marcados[p.k]?I('check'):i+1}</button>
      <div><b>${p.t}</b>${p.min?`<span class="mx-pm">${p.min} min</span>`:''}${p.d?`<p>${p.d}</p>`:''}${p.extra||''}</div></li>`).join('')}</ol>`;
}
function errosHtml(uid,rot){
  const l=RV.e().er.map((x,i)=>Object.assign([...x],{i})).filter(x=>x[0]===HOJE&&(x[5]?x[5]===rot:x[1]===uid&&uid));
  return `<div class="mx-erro" data-uid="${esc(uid||'')}" data-rot="${esc(rot||'')}">
    <input class="mx-in" data-er maxlength="240" placeholder="O que eu errei (uma linha)">
    <input class="mx-in" data-ct maxlength="240" placeholder="A frase certa (opcional)">
    <button class="mx-btn sec" data-acao="erro">${I('plus')}Anotar</button></div>
    ${l.length?`<ul class="mx-erros">${l.map(x=>`<li><span>${esc(x[2])}${x[3]?` <i>→ ${esc(x[3])}</i>`:''}</span><button data-acao="erro-del" data-i="${x.i}" aria-label="Apagar">${I('x')}</button></li>`).join('')}</ul>`:''}`;
}
/* questões da PMBA dentro da etapa (vem do estudo.js) */
const qb=(spec,rot)=>{const E=window.__estudo;return E&&E.pronto?E.botaoQuiz(spec,rot):'';};
const alvoB=u=>{const E=window.__estudo;const a=u&&E&&E.pronto&&E.alvoDaUnidade(u);return a?E.alvoChip(a):'';};
const qres=orig=>{const E=window.__estudo;return orig&&E&&E.pronto?E.resultado(orig):null;};
function resultadoHtml(acao,rotulo,dica,orig){
  const r=qres(orig);
  return `${r?`<p class="mx-dica" style="margin-top:12px">${I('circle-help')}Das questões da PMBA aqui no Mentor: <b>${r.a} de ${r.t}</b>. Somei abaixo; acrescente as do TEC se fez.</p>`:''}<div class="mx-res"><span>${rotulo||'Acertei'}</span><input type="number" inputmode="numeric" min="0" max="200" class="mx-in mx-num" data-a placeholder="0" ${r?`value="${r.a}"`:''}><span>de</span><input type="number" inputmode="numeric" min="1" max="200" class="mx-in mx-num" data-t placeholder="20" ${r?`value="${r.t}"`:''}>
    <button class="mx-btn" data-acao="${acao}">${I('check')}Concluir</button></div>${dica?`<p class="mx-dica">${dica}</p>`:''}`;
}
function tecLink(u,fallbackNome){
  const url=u&&(u.tec||RV.e().tec[u.id]);
  if(url) return `<a class="mx-btn sec" href="${esc(url)}" target="_blank" rel="noopener">${I('external-link')}Abrir o caderno no TEC</a>`;
  return `<a class="mx-btn sec" href="${TEC_FILTRO}" target="_blank" rel="noopener">${I('external-link')}Filtrar no TEC</a><span class="mx-dica">Filtre por <b>${esc(fallbackNome||'o assunto')}</b>, área Policial e Forças Armadas, 2019 em diante, sem anuladas.</span>`;
}
function material(arq,titulo){const nome=arq.startsWith('(')?arq:arq;return `<span class="mx-pdf">${I('file-text')}<span><b>${esc(titulo||arq.replace(/_Soldado_PMBA\.pdf$/,'').replace(/_/g,' '))}</b><i>${arq.startsWith('(')?'recebida no chat do projeto':'pasta Fichas do projeto, no app do Claude · '+esc(arq)}</i></span></span>`;}
function pedir(txt,rot){return `<button class="mx-pedir" data-acao="copiar" data-txt="${esc(txt)}">${I('msg')}${rot||'Pedir no chat'}</button>`;}

function etapaHtml(s,et,P){
  const ok=feita(s,et);
  const cab=`<header class="mx-fcab"><span class="mx-fic">${I(icEt(et))}</span><div><span class="mx-rot">${esc(et.titulo)}${et.min?' · '+fmtM(et.min):''}</span><h3>${esc(et.sub||'')}</h3></div>${ok?`<span class="mx-feito">${I('check')}feito</span>`:''}</header>`;
  if(et.tipo==='anki'&&et.cards) return cab+window.__estudo.etapaCards(et,ok);
  if(et.tipo==='anki') return cab+`${window.__estudo&&window.__estudo.pronto&&!window.__estudo.modoCards()?`<p class="mx-status ok" style="margin:0 0 12px">${I('sparkles')}<span>Os seus cards agora podem ser feitos aqui no Mentor, com repetição espaçada. <button class="mx-pedir" data-ir="cards" style="margin:0">Abrir a aba Cards</button></span></p>`:''}<p class="mx-porque">${I('brain')}Puxar da memória logo no começo acorda a cabeça e fixa o que você viu nos últimos dias.</p>
    <ol class="mx-simples"><li>Abra o app do Anki e faça <b>só os cards vencidos de hoje</b> (${et.min} min no máximo).</li><li>Card que você errou 3 vezes: me manda no chat que eu reescrevo.</li><li>Chegou baralho novo de ficha ou de erros? Importe antes de começar.</li></ol>
    <div class="mx-acoes">${ok?`<button class="mx-btn sec" data-acao="desmarcar" data-id="anki">${I('undo')}Desfazer</button>`:`<button class="mx-btn" data-acao="marcar" data-id="anki">${I('check')}Fiz o Anki</button>`}</div>`;
  if(et.tipo==='trilha') return cab+trilhaHtml(s,et,ok);
  if(et.tipo==='mistas') return cab+`<p>A trilha do zero acabou. Agora são 20 questões misturadas por dia, de tudo o que você já viu.</p>${qb({mat:et.fila==='P'?'Língua Portuguesa':'Matemática e RL',n:20,mix:true,orig:'mx:'+et.id})}${tecLink(null,et.fila==='P'?'Língua Portuguesa':'Matemática e Raciocínio Lógico')}
    <div class="mx-acoes">${ok?`<button class="mx-btn sec" data-acao="desmarcar" data-id="${et.id}">${I('undo')}Desfazer</button>`:`<button class="mx-btn" data-acao="marcar" data-id="${et.id}">${I('check')}Feito</button>`}</div>`;
  if(et.tipo==='rev') return cab+revEtapaHtml(s,et);
  if(et.tipo==='ficha') return cab+fichaHtml(s,et,ok);
  if(et.tipo==='atual') return cab+`<p class="mx-porque">${I('globe')}Atualidades cai pouco, mas cai sempre com fato dos 12 meses antes da prova. 30 minutos por semana bastam.</p>
    <ol class="mx-simples"><li>Uma fonte só (um resumo semanal de notícias). Uma linha por fato.</li><li>Prioridade: STF, leis novas de segurança, mulher e racismo, e fatos da Bahia.</li><li>Guarde as linhas num caderno do mês; véspera da prova, você relê.</li></ol>
    ${relogioHtml(et)}<div class="mx-acoes">${ok?`<button class="mx-btn sec" data-acao="desmarcar" data-id="atual">${I('undo')}Desfazer</button>`:`<button class="mx-btn" data-acao="marcar" data-id="atual">${I('check')}Feito</button>`}</div>`;
  if(et.tipo==='red') return cab+`<p class="mx-porque">${I('pen')}Uma redação por semana, sempre com tempo de prova. Escrever e mandar para correção vale mais que ler modelo.</p>
    <ol class="mx-simples"><li><b>10 min:</b> repertório e plano (tese + 2 argumentos + proposta).</li><li><b>40 min:</b> escreva à mão, 25 a 30 linhas, sem parar.</li><li><b>10 min:</b> releia, corte repetição e confira a proposta de intervenção.</li><li>Tire foto e mande no chat: eu corrijo pelos critérios da banca.</li></ol>
    ${relogioHtml(et)}<div class="mx-acoes">${ok?`<button class="mx-btn sec" data-acao="red-undo" data-i="${et.ri}">${I('undo')}Desfazer</button>`:`<button class="mx-btn" data-acao="red-ok" data-i="${et.ri}">${I('check')}Escrevi</button>`}${pedir('Segue minha redação da semana (tema: '+et.sub+'). Corrige pelos critérios da banca.','Mandar a redação')}</div>`;
  if(et.tipo==='ingles') return cab+`<p class="mx-porque">${I('lang')}O CFO tem Inglês e a gente não estuda durante a semana: um texto por domingo mantém a leitura em dia.</p>
    <ol class="mx-simples"><li>Um texto curto de prova (CFO PMBA ou banca parecida) com as questões.</li><li>Leia as perguntas antes do texto; sublinhe as palavras que você não sabe.</li><li>As palavras novas vão para o Anki (manda no chat).</li></ol>
    ${relogioHtml(et)}<div class="mx-acoes">${ok?`<button class="mx-btn sec" data-acao="desmarcar" data-id="ingles">${I('undo')}Desfazer</button>`:`<button class="mx-btn" data-acao="marcar" data-id="ingles">${I('check')}Feito</button>`}${pedir('Me passa um texto de Inglês de prova do CFO PMBA com as questões, para o domingo.','Pedir um texto')}</div>`;
  if(et.tipo==='atraso') return cab+atrasoHtml(s,et,ok);
  if(et.tipo==='semana') return cab+`<p class="mx-porque">${I('layers')}Misturar os assuntos da semana obriga a cabeça a escolher a regra certa, como na prova. É o que mais separa quem decorou de quem aprendeu.</p>
    <ol class="mx-simples"><li><b>20 questões misturadas</b> dos assuntos abaixo: comece pelas da PMBA aqui; se faltar, complete no TEC (área Policial e Forças Armadas).</li><li>Errou? Uma linha por erro.</li></ol>
    ${qb({us:et.lista.map(x=>x[2]).filter(Boolean),n:20,mix:true,orig:'semana'},'Fazer as questões da semana')}
    <ul class="mx-amanha">${et.lista.map(x=>`<li>${esc(x[0])} <i class="mx-dica" style="display:inline">${esc(x[1])}</i></li>`).join('')}</ul>
    <a class="mx-btn sec" href="${TEC_FILTRO}" target="_blank" rel="noopener" style="margin-top:10px">${I('external-link')}Filtrar no TEC</a>
    ${pedir('Monta no TEC um caderno de 20 questões misturadas da minha semana: '+et.lista.map(x=>x[0]).join('; ')+'.','Pedir o caderno da semana')}
    ${relogioHtml(et)}${errosHtml(null,'Questões da semana')}
    ${ok?`<div class="mx-ok">${I('circle-check-big')}<span>Feito.</span><button class="mx-btn sec" data-acao="desmarcar" data-id="semana">${I('undo')}Desfazer</button></div>`:`<div class="mx-acoes"><button class="mx-btn" data-acao="marcar" data-id="semana">${I('check')}Fiz as 20</button></div>`}`;
  if(et.tipo==='livre') return cab+`<p>Nada atrasado na semana. Descanse: o descanso também faz parte do plano.</p><p class="mx-dica">Se quiser adiantar, avance a ficha da vez pela aba Plano.</p>`;
  if(et.tipo==='fim') return cab+fimHtml(s,P,ok);
  return cab;
}

function trilhaHtml(s,et,ok){
  const t=et.t, tp=s.tp[t.id]||{}; const u=t.u&&U(t.u); const ant=anteriores(t);
  const temAula=t.aula.length>0;
  const passos=[
    {k:'pre',t:'Pré-teste: 3 a 5 questões antes da aula',min:5,d:temAula?'Estão na 1ª página da aula do zero. Responda sem olhar nada; errar aqui é o que prepara a cabeça.':'Faça 3 a 5 questões do assunto no TEC antes de ver o vídeo, mesmo chutando.'},
    {k:'aula',t:temAula?'Aula do zero':'Vídeo da aula',min:20,d:temAula?'Leia com calma, faça os "Sua vez" e confira as resolvidas.':(t.dicas.join(' · ')||'Pause e tente antes de ver a resolução.'),
      extra:(temAula?t.aula.map(a=>material(a,'Aula do zero '+((a.match(/Aula_(\d+)/)||[])[1]||'')+' · '+t.nome)).join(''):'')+(t.videos.length?`<details class="mx-vid" ${temAula?'':'open'}><summary>${I('circle-play')}${temAula?'Vídeos (opcional)':'Vídeos'}</summary><ul>${t.videos.map(v=>`<li><a href="${esc(v[1])}" target="_blank" rel="noopener">${esc(v[0])}</a></li>`).join('')}</ul></details>`:'')+(t.extra.length?`<div class="mx-extra">${t.extra.map(material).join('')}</div>`:'')},
    {k:'tec',t:`Questões: ${t.nq} de ${t.nome}${ant.length?` + 5 de ${ant.map(a=>a.nome).join(' e ')}`:''}`,min:15,d:'Comece pelas da PMBA aqui no Mentor e complete no TEC. Misturar com assunto antigo é o que segura a matéria na cabeça.',extra:qb({us:[t.u].concat(ant.map(a=>a.u)).filter(Boolean),n:Math.min(10,t.nq||10),orig:'t:'+t.id,sec:1})+tecLink(null,t.nome)+pedir(`Monta no TEC o caderno da trilha ${t.cod} (${t.nome}), no meu padrão: área Policial e Forças Armadas, 2019 em diante.`,'Pedir o caderno pronto')},
    {k:'erros',t:'Erros: uma linha por erro',min:3,d:'Escreva o que você pensou e a frase certa. No fechamento, a lista vira card de Anki.',extra:errosHtml(t.u,`Trilha ${t.cod} · ${t.nome}`)},
  ];
  const r=s.td[t.id];
  return `${u?`<p class="mx-meta">${chip(u.as,t.fila==='P'?'cy':'am')} ${chip(u.pp+' da prova','am')} ${alvoB(t.u)}</p>`:''}<p class="mx-porque">${I(t.fila==='P'?'type':'calc')}${t.fila==='P'?'Português vem primeiro porque é a matéria que você adia: cabeça fresca, sem desculpa.':'Matemática logo em seguida, antes das matérias que você gosta. Sessão curta, todo dia.'}</p>
    ${relogioHtml(et)}
    ${passosHtml(passos,tp,'t:'+t.id)}
    ${ok?`<div class="mx-ok">${I('circle-check-big')}<span>Sessão feita${r&&r[2]?`: ${r[1]} de ${r[2]} (${Math.round(r[1]/r[2]*100)}%)`:''}.</span><button class="mx-btn sec" data-acao="trilha-undo" data-id="${t.id}">${I('undo')}Desfazer</button>${proxTrilha(s,t)?`<button class="mx-btn sec" data-acao="trilha-mais" data-f="${t.fila}">${I('skip-forward')}Adiantar a próxima</button>`:''}</div>`
      :resultadoHtml('trilha-ok','Acertei',`Conta as ${t.nq+(ant.length?5:0)} questões do passo 3. Fez por fora? Pode concluir sem os números.`,'t:'+t.id)}`;
}
function proxTrilha(s,t){return filaT(t.fila).find(x=>!s.td[x.id]&&x.id!==t.id)||null;}

function fichaHtml(s,et,ok){
  const f=et.f; const fp=s.fp[f.id]||{}; const u=f.u&&U(f.u); const gasto=s.fm[f.id]||0; const totalMin=f.horas*60;
  const resto=Math.max(0,totalMin-gasto);
  if(!f.arq&&!ok){
    return `<p><b>${esc(f.mat)}</b> · ficha ${esc(f.nivel)} · ${String(f.horas).replace('.',',')}h · ${esc(f.pp)} da prova</p>
      <div class="mx-espera">${I('hourglass')}<div><b>Essa ficha ainda não chegou.</b><p>Ela é montada de manhã e chega no chat do projeto, com pré-teste e revisão. Se já chegou e o Mentor não sabe, marque abaixo.</p></div></div>
      <div class="mx-acoes">${pedir(`Monta a ficha da vez: ${f.nome} (${f.mat}), nível ${f.nivel}.`,'Pedir a ficha')}<button class="mx-btn sec" data-acao="ficha-chegou" data-id="${f.id}">${I('check')}Já tenho a ficha</button></div>`;
  }
  const passos=[
    {k:'pre',t:'Pré-teste sem olhar',min:5,d:'Está logo no começo da ficha. Responda tudo, mesmo chutando: a cabeça passa a procurar essas respostas na leitura.',extra:qb({u:f.u,n:5,orig:'fp:'+f.id,sec:1},'Pré-teste com questões da PMBA')},
    {k:'mapa',t:'Mapa geral: o roteiro da ficha',min:3,d:'Olhe a árvore inteira antes dos blocos. É o esqueleto onde cada detalhe vai pendurar.'},
    {k:'blocos',t:'Blocos: lei → traduzindo → como cai',min:Math.max(20,Math.round(totalMin*0.55)),d:'No fim de cada bloco, feche a ficha e fale em voz alta o que lembra (30 segundos). Depois confira.',
      extra:`<div class="mx-parei"><label>Parei na página</label><input type="number" inputmode="numeric" min="1" max="99" class="mx-in mx-num" data-parei="${f.id}" value="${esc((s.fpg||{})[f.id]||'')}" placeholder="—"><span class="mx-dica" style="margin:0">${(s.fpg||{})[f.id]?'Amanhã você continua da página '+esc(s.fpg[f.id])+'.':'Anote quando parar; amanhã a missão lembra.'}</span></div>`},
    {k:'ce',t:'Revisão C/E do fim + gabarito do pré-teste',min:10,d:'Compare com o que você marcou no pré-teste: o que mudou é o que você aprendeu hoje.'},
    {k:'tec',t:'20 questões: PMBA aqui + TEC',min:25,d:'Primeiro as da PMBA desse assunto aqui no Mentor (as que não saíram no pré-teste); depois complete as 20 no caderno do TEC, no seu padrão.',extra:qb({u:f.u,n:20,orig:'f:'+f.id,sec:1})+tecLink(u,f.nome)},
    {k:'erros',t:'Erros: uma linha por erro',min:3,extra:errosHtml(f.u,`Ficha · ${f.nome}`)},
  ];
  const r=s.fd[f.id];
  return `<p class="mx-meta">${chip(f.mat,'em')} ${chip('ficha '+f.nivel)} ${chip(f.pp+' da prova','am')} ${alvoB(f.u)}</p>
    ${f.cai?`<p class="mx-porque">${I('target')}<span><b>O que mais cai:</b> ${esc(f.cai)}.</span></p>`:''}
    ${f.arq?material(f.arq,'Ficha · '+f.nome):''}
    <div class="mx-fprog"><span>${fmtM(gasto)} de ${fmtM(totalMin)} nessa ficha</span>${barra(gasto/totalMin,'em')}<i>${ok?'':resto>et.min?`hoje vai até ${fmtM(et.min)}; o resto continua amanhã de onde parou`:'dá para fechar hoje'}</i></div>
    ${relogioHtml(et)}
    ${passosHtml(passos,fp,'f:'+f.id)}
    ${f.cards?`<p class="mx-dica">${I('brain')}Os cards dessa ficha já estão prontos (${esc(f.cards)}): importe no Anki.</p>`:`<p class="mx-dica">Terminou? ${pedir(`Terminei a ficha ${f.nome}. Faz os cards de Certo/Errado dela.`,'Pedir os cards da ficha')}</p>`}
    ${r&&r[0]===HOJE?`<div class="mx-ok">${I('circle-check-big')}<span>Ficha fechada${r[2]?`: ${r[1]} de ${r[2]} no TEC (${Math.round(r[1]/r[2]*100)}%)`:''}.</span><button class="mx-btn sec" data-acao="ficha-undo" data-id="${f.id}">${I('undo')}Desfazer</button></div>`
      :ok?`<div class="mx-ok">${I('circle-check-big')}<span>Parou por hoje. Amanhã continua de onde parou.</span><button class="mx-btn sec" data-acao="desmarcar" data-id="ficha">${I('undo')}Voltar</button></div>`
      :`<div class="mx-acoes"><button class="mx-btn sec" data-acao="ficha-pausa">${I('pause')}Parar por hoje</button></div>${resultadoHtml('ficha-ok','Nas questões acertei','Concluir fecha a ficha e a próxima da fila passa a ser a da vez.','f:'+f.id)}`}`;
}

function revItemHtml(p,ok){
  const u=U(p.u)||{as:p.u,mat:'',pp:'',cai:'',f:3};
  const fx={1:['Núcleo','f1'],2:['Forte','f2'],3:['Manutenção','f3']}[u.f]||['Manutenção','f3'];
  const atr=entre(p.desde,HOJE);
  const tipo=p.tipo==='q'?'reta final':p.tipo==='l'?'leitura final':p.tipo==='x'?'reforço':'';
  const n=p.tipo==='q'?'20':p.tipo==='l'?'5 a 10':'10 a 15';
  const aberto=abertoRev===p.u;
  return `<div class="mx-rv ${aberto?'aberto':''}" data-u="${esc(p.u)}">
    <button class="mx-rv-top" data-acao="rv-abre" aria-expanded="${aberto}"><span class="mx-fx ${fx[1]}">${fx[0]}</span>
      <span class="mx-rv-n"><b>${esc(u.as)} ${alvoB(p.u)}</b><i>${esc(u.mat)} · ${esc(u.pp)} da prova · ${p.min} min${tipo?' · '+tipo:''}</i></span>
      ${atr>0?`<span class="mx-chip am">${atr===1?'de ontem':'há '+atr+' dias'}</span>`:''}${I('chevron-down','mx-seta')}</button>
    ${aberto?`<div class="mx-rv-c">
      <ol class="mx-simples"><li>${p.tipo==='l'?`<b>Leitura final (10 min):</b> passe os olhos só nas caixas de pegadinha da ficha. Foco: ${esc(u.cai)}.`:`<b>Lembrar sem olhar (2 min):</b> fale ou rabisque o que você lembra de <i>${esc(u.cai)}</i>. Só depois confira na ficha o que faltou.`}</li>
      <li><b>Questões (${n}):</b> primeiro as da PMBA aqui; no fim, o Mentor já conclui a revisão com o seu resultado.${qb({u:p.u,n:p.tipo==='q'?20:10,orig:'r:'+p.u})}<span class="mx-dica">Quer mais volume? ${tecLink(u,u.as)} Continue de onde parou: cada revisão pega as próximas questões do mesmo caderno.</span></li>
      <li><b>Erros:</b> uma linha por erro.${errosHtml(p.u,'')}</li></ol>
      ${resultadoHtml('rv-ok','Acertei','Abaixo de 60%, o assunto volta em 3 dias. De 85% para cima, a próxima revisão dele fica dispensada.','r:'+p.u)}
      <div class="mx-acoes"><button class="mx-btn sec" data-acao="rv-adiar">${I('calendar-days')}Amanhã</button></div></div>`:''}
  </div>`;
}
function revEtapaHtml(s,et){
  const e=RV.e(); const feitas=RV.feitasHoje(e);
  return `<p class="mx-porque">${I('rotate-ccw')}O que mais cai volta mais vezes. Cada revisão começa lembrando sem olhar: é isso que fixa, não a releitura.</p>
    ${relogioHtml(et)}
    ${et.rev.map(p=>revItemHtml(p)).join('')||''}
    ${feitas.length?`<ul class="mx-feitas">${feitas.map(x=>{const u=U(x.u)||{as:x.u};return `<li>${I('check')}<span>${esc(u.as)}</span><b>${x.t?Math.round(x.a/x.t*100)+'%':''}</b><button data-acao="rv-undo" data-k="${esc(x.k)}" aria-label="Desfazer">${I('undo')}</button></li>`;}).join('')}</ul>`:''}
    ${et.fila&&et.fila.length?`<p class="mx-dica">${I('hourglass')}Mais ${et.fila.length} na fila (${et.fila.slice(0,3).map(p=>esc((U(p.u)||{}).as)).join(', ')}${et.fila.length>3?'…':''}). Sobrou tempo? Abra a aba Revisão. ${semana(HOJE)===0?'O que não der hoje entra amanhã pela faixa.':'Senão, o domingo cobre.'}</p>`:''}`;
}
function atrasoHtml(s,et,ok){
  const aP=atrasoTrilha('P',s), aM=atrasoTrilha('M',s);
  const pts=[];
  return `<p class="mx-porque">${I('calendar-check')}Domingo não tem conteúdo novo: é para zerar o que ficou para trás, do que mais cai para o que menos cai.</p>
    ${relogioHtml(et)}
    <ol class="mx-simples">
      ${et.rev.length?`<li><b>Revisões atrasadas (${et.rev.length}):</b> de cima para baixo.</li>`:''}
      ${aP?`<li><b>Português:</b> ${aP} ${plural(aP,'sessão','sessões')} da trilha atrás. Faça a próxima pela aba Plano.</li>`:''}
      ${aM?`<li><b>Matemática:</b> ${aM} ${plural(aM,'sessão','sessões')} atrás.</li>`:''}
      ${atrasoFichas(s)?`<li><b>Ficha da vez:</b> avance ${esc((fichaDaVez(s)||{}).nome||'')} pela aba Plano.</li>`:''}
    </ol>
    ${et.rev.slice(0,8).map(p=>revItemHtml(p)).join('')}
    <div class="mx-acoes">${ok?`<button class="mx-btn sec" data-acao="desmarcar" data-id="atraso">${I('undo')}Desfazer</button>`:`<button class="mx-btn" data-acao="marcar" data-id="atraso">${I('check')}Fiz o que deu</button>`}</div>`;
}
function fimHtml(s,P,ok){
  const pend=ER.pend(); const hoje=pend.filter(x=>x[0]===HOJE);
  const amanha=add(HOJE,1); const ss=S();
  const prox=[];
  if(semana(amanha)!==0){const tp=filaT('P').find(t=>!ss.td[t.id]), tm=filaT('M').find(t=>!ss.td[t.id]);
    if(tp)prox.push(`Português ${tp.cod} · ${tp.nome}`); if(tm)prox.push(`Matemática ${tm.cod} · ${tm.nome}`);
    const f=fichaDaVez(ss); if(f) prox.push(`Ficha: ${f.nome}`);}
  else prox.push('Domingo: pôr em dia e o texto de Inglês');
  const rAm=RV.abertos(RV.e()).filter(x=>x.d===amanha); if(rAm.length) prox.push(`Revisão: ${rAm.map(x=>(U(x.u)||{}).as).join(', ')}`);
  return `<ol class="mx-simples">
      <li><b>Erros do dia: ${hoje.length}</b>${pend.length>hoje.length?` (e ${pend.length-hoje.length} de outros dias)`:''}. ${pend.length?'Copie a lista, cole no chat e eu faço os cards.':'Nenhum erro anotado esperando card.'}
        ${pend.length?`<div class="mx-acoes"><button class="mx-btn sec" data-acao="erros-copiar">${I('copy')}Copiar os erros</button><button class="mx-btn sec" data-acao="erros-enviados">${I('check')}Já mandei</button></div>`:''}</li>
      <li><b>Amanhã (${dLonga(amanha)}):</b><ul class="mx-amanha">${prox.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></li>
    </ol>
    <div class="mx-acoes">${ok||dia(s).fim?`<button class="mx-btn sec" data-acao="fim-undo">${I('undo')}Reabrir o dia</button>`:`<button class="mx-btn" data-acao="fim">${I('flag')}Fechar o dia</button>`}</div>`;
}
function fimDoDiaHtml(s,ets){
  const d=dia(s); const gasto=Object.values(d.m).reduce((a,x)=>a+x,0);
  const st=streak(S());
  return `<section class="mx-cumprida">${I('trophy')}<div><b>Missão cumprida.</b><p>${ets.filter(e=>e.ok).length} etapas${gasto?' · '+fmtM(gasto)+' cronometrados':''} · ${st} ${plural(st,'dia')} seguidos. Descansa que amanhã tem mais.</p></div></section>`;
}

/* ---------------- REVISÃO ---------------- */
function vRevisao(s){
  const e=RV.e(); const pend=RV.pendentes(e); const hoje=pend.filter(x=>x.d===HOJE), atras=pend.filter(x=>x.d<HOJE);
  const feitas=RV.feitasHoje(e); const prox=RV.proximos(e,7);
  const ult={}; Object.entries(e.f).sort((a,b)=>a[1][2]<b[1][2]?-1:1).forEach(([k,v])=>{ult[k.split('|')[1]]=v;});
  const fracos=Object.entries(ult).filter(([u,v])=>v[1]&&v[0]/v[1]<0.6).map(([u,v])=>[(U(u)||{}).as||u,Math.round(v[0]/v[1]*100)]);
  const pE=ER.pend();
  return `<header class="mx-cab"><h1>Revisão</h1><p>O que mais cai volta mais vezes. Cada uma: lembrar sem olhar, questões no seu caderno do TEC, acertos e uma linha por erro.</p></header>
  <section class="mx-card"><h2 class="mx-h3">${I('rotate-ccw')}Hoje <i>${hoje.length?hoje.reduce((a,x)=>a+x.min,0)+' min':''}</i></h2>
    ${hoje.map(p=>revItemHtml(p)).join('')||`<p class="mx-vazio">${atras.length?'Nada novo para hoje. Faça o que ficou para trás, de cima para baixo.':'Nada para revisar hoje.'}</p>`}
    ${feitas.length?`<ul class="mx-feitas">${feitas.map(x=>`<li>${I('check')}<span>${esc((U(x.u)||{}).as||x.u)}</span><b>${x.t?Math.round(x.a/x.t*100)+'%':''}</b><button data-acao="rv-undo" data-k="${esc(x.k)}" aria-label="Desfazer">${I('undo')}</button></li>`).join('')}</ul>`:''}</section>
  ${atras.length?`<section class="mx-card"><h2 class="mx-h3">${I('hourglass')}Ficou para trás <i>${atras.length}</i></h2><p class="mx-dica">Os de cima caem mais na prova: faça esses primeiro.</p>${atras.map(p=>revItemHtml(p)).join('')}</section>`:''}
  <section class="mx-card"><h2 class="mx-h3">${I('calendar-days')}Próximos 7 dias</h2>
    <ul class="mx-prox">${prox.map(([d,l])=>`<li><b>${dLonga(d)}</b><span>${l.map(x=>esc((U(x.u)||{}).as)).join(' · ')}</span></li>`).join('')||'<li class="mx-vazio">Nada marcado.</li>'}</ul></section>
  <section class="mx-card"><h2 class="mx-h3">${I('brain')}Erros para o Anki <i>${pE.length}</i></h2>
    ${pE.length?`<ul class="mx-erros grande">${pE.slice(-30).reverse().map(x=>`<li><span><i>${dd(x[0])} · ${esc(ER.rot(x))}</i>${esc(x[2])}${x[3]?` <i>→ ${esc(x[3])}</i>`:''}</span><button data-acao="erro-del" data-i="${x.i}" aria-label="Apagar">${I('x')}</button></li>`).join('')}</ul>
      <div class="mx-acoes"><button class="mx-btn" data-acao="erros-copiar">${I('copy')}Copiar para o chat</button><button class="mx-btn sec" data-acao="erros-enviados">${I('check')}Já mandei</button></div>`:'<p class="mx-vazio">Nenhum erro esperando card.</p>'}
    ${fracos.length?`<p class="mx-dica">Abaixo de 60% na última vez: ${fracos.map(f=>`${esc(f[0])} (${f[1]}%)`).join(' · ')}</p>`:''}</section>`;
}

/* ---------------- PLANO ---------------- */
function vPlano(s){
  const fS=filaF('Soldado'), fC=filaF('CFO');
  const okS=fS.filter(f=>s.fd[f.id]).length, okC=fC.filter(f=>s.fd[f.id]).length;
  const vez=fichaDaVez(s);
  const tP=filaT('P'), tM=filaT('M');
  const okP=tP.filter(t=>s.td[t.id]).length, okM=tM.filter(t=>s.td[t.id]).length;
  const proj=projecao(s);
  const sec=(id,tit,sub,corpo,abertoPadrao)=>{const ab=planoAberto[id]!=null?planoAberto[id]:abertoPadrao;return `<section class="mx-card"><button class="mx-sec" data-acao="sec" data-id="${id}" aria-expanded="${ab}"><span><b>${tit}</b><i>${sub}</i></span>${I('chevron-down','mx-seta')}</button>${ab?corpo:''}</section>`;};
  const linhaT=t=>{const r=s.td[t.id];const prox=!r&&filaT(t.fila).find(x=>!s.td[x.id])===t;
    return `<li class="${r?'ok':''} ${prox?'atual':''}"><span class="mx-n">${r?I('check'):esc(t.cod)}</span><span class="mx-lt"><b>${esc(t.cod)} · ${esc(t.nome)}${t.n>1?` (${t.k}/${t.n})`:''}</b><i>${r?(r[0]?'feita '+dd(r[0]):'feita antes')+(r[2]?` · ${r[1]}/${r[2]}`:''):'plano: '+dd(t.data)}${t.aula.length?' · aula do zero pronta':''}</i></span>
      ${r?`<button class="mx-mini" data-acao="trilha-undo" data-id="${t.id}" aria-label="Desfazer">${I('undo')}</button>`:prox?`<button class="mx-mini" data-acao="trilha-pular" data-id="${t.id}">Já fiz</button>`:''}</li>`;};
  const linhaF=f=>{const r=s.fd[f.id];const atual=vez===f;
    return `<li class="${r?'ok':''} ${atual?'atual':''}"><span class="mx-n">${r?I('check'):I(f.arq?'file-text':'hourglass')}</span><span class="mx-lt"><b>${esc(f.nome)}</b><i>${esc(f.mat)} · ${esc(f.nivel)} · ${String(f.horas).replace('.',',')}h · ${esc(f.pp)}${r?` · feita ${r[0]?dd(r[0]):''}`:` · semana de ${dd(f.ini)}`}${s.fm[f.id]&&!r?` · ${fmtM(s.fm[f.id])} feitos`:''}</i></span>
      ${r?`<button class="mx-mini" data-acao="ficha-undo" data-id="${f.id}" aria-label="Desfazer">${I('undo')}</button>`:atual?`<button class="mx-mini" data-acao="ficha-pular" data-id="${f.id}">Já fiz</button>`:''}</li>`;};
  return `<header class="mx-cab"><h1>Plano até a prova</h1><p>Prova de Soldado prevista para ${dd(MJ.prova.Soldado)}/${MJ.prova.Soldado.slice(0,4)} (provisória até o edital). As fichas de Soldado fecham até ${dd(MJ.prova.soldado_fichas_ate)}, as do CFO em fevereiro, e março é de questões e simulados.</p></header>
  <section class="mx-card mx-resumo">
    <div><span class="mx-rot">Fichas de Soldado</span><b>${okS}<i>/${fS.length}</i></b>${barra(okS/fS.length,'em')}</div>
    <div><span class="mx-rot">Português do zero</span><b>${okP}<i>/${tP.length}</i></b>${barra(okP/tP.length,'cy')}</div>
    <div><span class="mx-rot">Matemática do zero</span><b>${okM}<i>/${tM.length}</i></b>${barra(okM/tM.length,'am')}</div>
  </section>
  ${proj?`<div class="mx-status ${proj.cor}">${I(proj.ic)}<span>${proj.txt}</span></div>`:''}
  ${(()=>{const iV=Math.max(0,fS.indexOf(vez)); const todas=planoAberto['fs-todas'];
    const vis=todas?fS:fS.filter((f,i)=>s.fd[f.id]&&s.fd[f.id][0]&&entre(s.fd[f.id][0],HOJE)<=7||(i>=iV&&i<iV+6));
    return sec('fs','Fichas de Soldado',`${okS} de ${fS.length}${vez&&vez.prova==='Soldado'?' · da vez: '+esc(vez.nome):''}`,
      `<ol class="mx-lista">${vis.map(linhaF).join('')}</ol><button class="mx-mais" data-acao="sec" data-id="fs-todas" aria-expanded="${!!todas}">${todas?'Mostrar só as próximas':'Ver as '+fS.length+' fichas'}</button>`,true);})()}
  ${sec('tp','Português do zero',`${okP} de ${tP.length} sessões`,`<ol class="mx-lista">${tP.map(linhaT).join('')}</ol>`,false)}
  ${sec('tm','Matemática do zero',`${okM} de ${tM.length} sessões`,`<ol class="mx-lista">${tM.map(linhaT).join('')}</ol>`,false)}
  ${sec('fc','Fichas do CFO (fevereiro)',`${okC} de ${fC.length}`,`<ol class="mx-lista">${fC.map(linhaF).join('')}</ol>`,false)}
  ${sec('rd','Redação (um tema por sábado, a partir de 05/12)',`${Object.keys(s.rd).length} de ${MJ.redacao.temas.length}`,`<ol class="mx-lista">${MJ.redacao.temas.map((t,i)=>`<li class="${s.rd[i]?'ok':''}"><span class="mx-n">${s.rd[i]?I('check'):i+1}</span><span class="mx-lt"><b>${esc(t)}</b><i>${s.rd[i]?'feita '+dd(s.rd[i]):''}</i></span></li>`).join('')}</ol>`,false)}`;
}
function projecao(s){
  const fS=filaF('Soldado'); const falta=fS.filter(f=>!s.fd[f.id]);
  if(!falta.length) return {cor:'ok',ic:'trophy',txt:'Todas as fichas de Soldado feitas. Agora é CFO e questões.'};
  const horasFalta=falta.reduce((a,f)=>a+f.horas*60-(s.fm[f.id]||0),0);
  /* ritmo: minutos de ficha nos últimos 14 dias (no começo, usa o plano: ~85 min por dia útil) */
  let min=0,dias=0; for(let i=1;i<=14;i++){const d=add(HOJE,-i);const x=s.d[d];if(x){dias++;min+=(x.m&&x.m.ficha)||0;}}
  const porDia=dias>=5&&min>0?min/14*7/6:85;
  const diasUteis=Math.ceil(horasFalta/porDia);
  let d=HOJE,n=0; while(n<diasUteis){d=add(d,1);if(semana(d)!==0)n++;}
  const meta=MJ.prova.soldado_fichas_ate;
  const folga=entre(d,meta);
  return folga>=0?{cor:'ok',ic:'shield-check',txt:`No ritmo de ${fmtM(porDia)} de ficha por dia, as de Soldado fecham em ${dd(d)}, ${folga} ${plural(folga,'dia')} antes da meta (${dd(meta)}).`}
    :{cor:'warn',ic:'hourglass',txt:`No ritmo de ${fmtM(porDia)} de ficha por dia, as de Soldado fecham em ${dd(d)}, ${-folga} ${plural(-folga,'dia')} depois da meta (${dd(meta)}). Um dia de 5h por semana recupera.`};
}

/* ---------------- PROGRESSO ---------------- */
function cobertura(s){
  const feitosCod=new Set(MJ.trilha.filter(t=>s.td[t.id]).map(t=>t.cod+'|'+t.k));
  const codFeito=c=>{const l=MJ.trilha.filter(t=>t.cod===c);return l.length?l.filter(t=>feitosCod.has(t.cod+'|'+t.k)).length/l.length:1;};
  const fichaFeita={}; MJ.fichas.forEach(f=>{if(s.fd[f.id])fichaFeita[f.nome]=1;});
  let tot=0,ok=0; const porMat={};
  MJ.cobertura.forEach(([uid,modo,pp,cods])=>{
    const u=U(uid)||{mat:'?',as:uid}; let v=0;
    if(modo==='feito') v=1; else if(modo==='ficha') v=fichaFeita[u.as]?1:0; else v=cods.length?cods.reduce((a,c)=>a+codFeito(c),0)/cods.length:1;
    tot+=pp; ok+=pp*v; const m=porMat[u.mat]=porMat[u.mat]||[0,0]; m[0]+=pp*v; m[1]+=pp;
  });
  return {p:ok/tot, ok, tot, porMat};
}
function streak(s){
  const h=horasVis();
  const conta=d=>(s.d[d]&&(s.d[d].fim||Object.values(s.d[d].m||{}).reduce((a,x)=>a+x,0)>=90))||(h[d]||0)>=90;
  let n=0; let d=conta(HOJE)?HOJE:add(HOJE,-1);
  for(let i=0;i<400;i++){if(semana(d)===0&&!conta(d)){d=add(d,-1);continue;} if(!conta(d))break; n++; d=add(d,-1);}
  return n;
}
function acertosPorMat(s){
  const r={}; const e=RV.e();
  const soma=(m,a,t)=>{if(!t)return;const x=r[m]=r[m]||[0,0];x[0]+=a;x[1]+=t;};
  Object.entries(e.f).forEach(([k,v])=>{const u=U(k.split('|')[1]);if(u)soma(u.mat,v[0],v[1]);});
  MJ.trilha.forEach(t=>{const v=s.td[t.id];if(v&&v[2])soma(t.fila==='P'?'Língua Portuguesa':'Matemática e RL',v[1],v[2]);});
  MJ.fichas.forEach(f=>{const v=s.fd[f.id];if(v&&v[2])soma(f.mat,v[1],v[2]);});
  return r;
}
function vProgresso(s){
  const c=cobertura(s); const st=streak(s);
  const h=horasVis();
  const dias=[];for(let i=13;i>=0;i--){const d=add(HOJE,-i);dias.push([d,h[d]||0]);}
  const max=Math.max(240,...dias.map(x=>x[1]));
  const sem=dias.slice(-7).reduce((a,x)=>a+x[1],0);
  const ac=acertosPorMat(s); const acL=Object.entries(ac).sort((a,b)=>a[1][0]/a[1][1]-b[1][0]/b[1][1]);
  const mats=Object.entries(c.porMat).sort((a,b)=>b[1][1]-a[1][1]);
  return `<header class="mx-cab"><h1>Progresso</h1><p>O que importa para a aprovação: quanto da prova você já cobriu, constância e acerto.</p></header>
  <section class="mx-card mx-cob"><div class="mx-cob-anel">${anel(c.p,120)}<b>${pctTxt(c.p*100)}<i>da prova coberta</i></b></div>
    <div class="mx-cob-t"><p>Soma do peso (% das questões da prova) dos assuntos que você já estudou. Cada ficha e cada assunto da trilha que você fecha aumenta esse número.</p>
    <p class="mx-dica">Meta: passar de 85% até ${dd(MJ.prova.soldado_fichas_ate)}, quando fecham as fichas de Soldado.</p></div></section>
  <section class="mx-resumo mx-card">
    <div><span class="mx-rot">Dias seguidos</span><b>${st}<i>${I('flame')}</i></b></div>
    <div><span class="mx-rot">Últimos 7 dias</span><b>${fmtM(sem)}</b></div>
    <div><span class="mx-rot">Para a prova</span><b>${diasProva()}<i>dias</i></b></div>
  </section>
  <section class="mx-card"><h2 class="mx-h3">${I('clock')}Horas por dia <i>meta 4h</i></h2>
    <div class="mx-barras">${dias.map(([d,m])=>`<div class="${d===HOJE?'hoje':''}" title="${dLonga(d)}: ${fmtM(m)}"><i style="height:${Math.round(m/max*100)}%" class="${m>=240?'ok':m>=120?'meio':''}"></i><span>${SEM[semana(d)][0].toUpperCase()}</span></div>`).join('')}<hr style="bottom:${Math.round(240/max*100)}%"></div></section>
  <section class="mx-card"><h2 class="mx-h3">${I('layers')}Cobertura por matéria</h2>
    <ul class="mx-mats">${mats.map(([m,v])=>`<li><span>${esc(m)}</span>${barra(v[0]/v[1],'em')}<b>${Math.round(v[0]/v[1]*100)}%</b></li>`).join('')}</ul></section>
  <section class="mx-card"><h2 class="mx-h3">${I('target')}Acerto por matéria</h2>
    ${acL.length?`<ul class="mx-mats">${acL.map(([m,v])=>{const p=v[0]/v[1];return `<li><span>${esc(m)}</span>${barra(p,p<0.6?'ro':p<0.8?'am':'em')}<b>${Math.round(p*100)}%</b></li>`;}).join('')}</ul><p class="mx-dica">Conta as revisões, as sessões da trilha e as fichas em que você anotou os acertos. Vermelho (abaixo de 60%) é onde a revisão volta mais cedo.</p>`:'<p class="mx-vazio">Ainda sem acertos anotados. Eles aparecem aqui conforme você conclui as etapas.</p>'}</section>`;
}

/* ---------------- MAIS ---------------- */
function vMais(s){
  const h=s.cfg.h||{};
  const ant=[['inicio','Início antigo (aula do curso)','home'],['plano','Planejamento por aulas do curso','calendar-days'],['questoes','Questões do banco','circle-help'],['sim','Simulados','clipboard-check'],['edital','Edital verticalizado','list-checks'],['geral','Plano geral antigo','bar-chart-3']];
  return `<header class="mx-cab"><h1>Mais</h1></header>
  <section class="mx-card"><h2 class="mx-h3">${I('cog')}Horas por dia</h2><p class="mx-dica">O plano de cada dia se ajusta a isso. No próprio dia você ainda pode trocar no "Hoje eu tenho".</p>
    <ul class="mx-hsem">${[1,2,3,4,5,6,0].map(w=>{const v=h[w]!=null?h[w]:(w===0?2:4);return `<li><span>${cap(SEMX[w])}</span><div class="mx-horas mini">${[0,2,3,4,5,6].map(n=>`<button data-acao="hsem" data-w="${w}" data-h="${n}" aria-pressed="${v===n}">${n?n+'h':'folga'}</button>`).join('')}</div></li>`;}).join('')}</ul></section>
  <section class="mx-card"><h2 class="mx-h3">${I('external-link')}Atalhos</h2>
    <div class="mx-atalhos"><a href="${TEC_PASTA}" target="_blank" rel="noopener">${I('folder')||I('layers')}Minha pasta no TEC</a><button data-acao="como">${I('info')}Como funciona a missão</button><button data-acao="copiar" data-txt="O que estudar hoje? Olha meu Mentor.">${I('msg')}Perguntar no chat</button></div></section>
  <section class="mx-card"><h2 class="mx-h3">${I('layers')}Ferramentas antigas</h2><p class="mx-dica">O Mentor de antes continua aqui, do jeito que era.</p>
    <div class="mx-atalhos">${ant.map(a=>`<button data-acao="antigo" data-aba="${a[0]}">${I(a[2])}${a[1]}</button>`).join('')}</div></section>
  <p class="mx-versao">Missão ${VERSAO} · dados ${esc(MJ.versao)}${window.__VERSAO?' · API '+esc(window.__VERSAO):''}</p>`;
}

/* ================================================================ montagem */
function render(){
  if(!MJ||!RJ) return;
  const s=S();
  topo.innerHTML=htmlTopo(s);
  nav.innerHTML=ABAS.map(a=>`<button data-ir="${a[0]}" aria-current="${abaNav(aba)===a[0]?'page':'false'}">${I(a[2])}<span>${a[1]}</span></button>`).join('');
  const y=window.scrollY;
  app.dataset.aba=aba;
  const E=window.__estudo, eV=f=>E&&E.pronto?E[f](s):'<section class="mx-card"><b>Carregando questões e cards…</b></section>';
  app.innerHTML=aba==='revisao'?vRevisao(s):aba==='plano'?segPlano()+vPlano(s):aba==='progresso'?segPlano()+vProgresso(s):aba==='alvo'?segPlano()+eV('vAlvo'):aba==='mais'?vMais(s):aba==='questoes'?eV('vQuestoes'):aba==='cards'?eV('vCards'):vHoje(s);
  window.scrollTo(0,y);
}
function segPlano(){return `<div class="mx-segp" role="group" aria-label="Plano">${[['plano','Plano'],['progresso','Progresso'],['alvo','Alvo SD × CFO']].map(([k,t])=>`<button data-ir="${k}" aria-current="${aba===k?'page':'false'}">${t}</button>`).join('')}</div>`;}
function ir(a){aba=a;try{history.replaceState(null,'','#m-'+a);}catch(_){}render();window.scrollTo(0,0);}

function lerRes(box){const a=parseInt((box.querySelector('[data-a]')||{}).value,10), t=parseInt((box.querySelector('[data-t]')||{}).value,10);
  if(isNaN(a)&&isNaN(t)) return {vazio:true}; if(!(t>0)||!(a>=0)||a>t) return {erro:true}; return {a,t};}

function etapaAtual(id){const s=S();return plano(s).ets.find(e=>e.id===id);}
async function clique(ev){
  const b=ev.target.closest('[data-acao],[data-ir],[data-foco]'); if(!b) return;
  if(b.dataset.ir){ir(b.dataset.ir);return;}
  if(b.dataset.foco){foco=b.dataset.foco;render();const f=document.querySelector('.mx-foco');if(f)f.scrollIntoView({behavior:'smooth',block:'start'});return;}
  const a=b.dataset.acao; const card=b.closest('[data-et]'); const etId=card&&card.dataset.et;
  const s=S();
  switch(a){
    case 'intro': s.cfg.intro=1; salvar(s); return render();
    case 'como': s.cfg.intro=0; salvar(s); return ir('hoje');
    case 'horas': {dia(s).h=+b.dataset.h; salvar(s); aviso(`Dia de ${b.dataset.h}h: o plano se ajustou`,'clock'); return render();}
    case 'hsem': {s.cfg.h=s.cfg.h||{}; s.cfg.h[b.dataset.w]=+b.dataset.h; salvar(s); return render();}
    case 'relogio': {const t=T.ler(); if(t&&t.ini){T.pausar();render();} else {ir('hoje');} return;}
    case 'iniciar': {const et=etapaAtual(etId); if(et){T.iniciar(et); aviso('Valendo. Foco total por '+fmtM(et.min),'play');} return render();}
    case 'pausar': T.pausar(); return render();
    case 'marcar': {const d=dia(s); d.ok[b.dataset.id]=1; salvar(s); if(T.doId(b.dataset.id))T.zerar(); avancar(); return;}
    case 'desmarcar': {const d=dia(s); delete d.ok[b.dataset.id]; salvar(s); return render();}
    case 'passo': {const [tp,id]=b.dataset.tipo.split(/:(.+)/); const alvo=tp==='t'?s.tp:s.fp; alvo[id]=alvo[id]||{}; if(alvo[id][b.dataset.p])delete alvo[id][b.dataset.p]; else alvo[id][b.dataset.p]=1; salvar(s); return render();}
    case 'erro': {const box=b.closest('.mx-erro'); const er=(box.querySelector('[data-er]').value||'').replace(/\s+/g,' ').trim(); const ct=(box.querySelector('[data-ct]').value||'').replace(/\s+/g,' ').trim();
      if(er.length<3){aviso('Escreva o erro em uma linha','zap');return;} ER.add(box.dataset.uid||null,box.dataset.rot||'',er,ct); aviso('Erro anotado: vai para a lista do Anki','check'); return render();}
    case 'erro-del': ER.del(+b.dataset.i); return render();
    case 'erros-copiar': await copiar(ER.texto()); return;
    case 'erros-enviados': ER.enviados(); aviso('Marcado como enviado','check'); return render();
    case 'copiar': await copiar(b.dataset.txt); return;
    case 'trilha-ok': {const et=etapaAtual(etId); if(!et||!et.t) return; const r=lerRes(b.closest('.mx-foco'));
      if(r.erro){aviso('Confira os números: acertos até o total','zap');return;}
      s.td[et.t.id]=[HOJE,r.vazio?null:r.a,r.vazio?null:r.t]; salvar(s); if(T.doId(et.id))T.zerar();
      aviso(r.vazio?'Sessão feita':`Sessão feita: ${Math.round(r.a/r.t*100)}%`,'circle-check-big'); avancar(); return;}
    case 'trilha-undo': {delete s.td[b.dataset.id]; salvar(s); return render();}
    case 'trilha-pular': {s.td[b.dataset.id]=[HOJE,null,null]; salvar(s); aviso('Marcada como feita','check'); return render();}
    case 'trilha-mais': {const f=b.dataset.f; const t=filaT(f).find(x=>!s.td[x.id]); if(!t)return; aviso(`Próxima: ${t.cod} · ${t.nome}. Bora!`,'skip-forward');
      const d=dia(s); d.adi=d.adi||{}; d.adi[f]=filaT(f).filter(x=>s.td[x.id]&&s.td[x.id][0]===HOJE).length; salvar(s); foco=f; return render();}
    case 'ficha-chegou': {const f=MJ.fichas.find(x=>x.id===b.dataset.id); if(f){f.arq=f.arq||'(ficha recebida no chat)';} s.cfg.chegou=s.cfg.chegou||{}; s.cfg.chegou[b.dataset.id]=1; salvar(s); return render();}
    case 'ficha-pausa': {T.pausar(true); T.gravar(null); dia(s).ok.ficha=1; salvar(s); aviso('Parou por hoje. Amanhã continua de onde parou','pause'); avancar(); return;}
    case 'ficha-ok': {const et=etapaAtual(etId); if(!et||!et.f) return; const r=lerRes(b.closest('.mx-foco'));
      if(r.erro){aviso('Confira os números: acertos até o total','zap');return;}
      if(T.doId('ficha'))T.zerar(); const s2=S(); s2.fd[et.f.id]=[HOJE,r.vazio?null:r.a,r.vazio?null:r.t]; dia(s2).ok.ficha=1; salvar(s2);
      aviso('Ficha fechada. A próxima da fila já é a da vez','trophy'); avancar(); return;}
    case 'ficha-undo': {delete s.fd[b.dataset.id]; const d=dia(s); delete d.ok.ficha; salvar(s); return render();}
    case 'ficha-pular': {s.fd[b.dataset.id]=[HOJE,null,null]; salvar(s); aviso('Marcada como feita','check'); return render();}
    case 'red-ok': {s.rd[b.dataset.i]=HOJE; salvar(s); if(T.doId('red'))T.zerar(); avancar(); return;}
    case 'red-undo': {delete s.rd[b.dataset.i]; salvar(s); return render();}
    case 'rv-abre': {const u=b.closest('.mx-rv').dataset.u; abertoRev=abertoRev===u?null:u; return render();}
    case 'rv-ok': {const box=b.closest('.mx-rv'); const r=lerRes(box); if(r.vazio||r.erro){aviso('Preencha acertos e feitas','zap');return;}
      const p=RV.pendentes(RV.e()).find(x=>x.u===box.dataset.u); if(!p) return; const m=RV.concluir(p,r.a,r.t); abertoRev=null; aviso(m,r.a/r.t<0.6?'rotate-ccw':'circle-check-big'); return depoisRev();}
    case 'rv-adiar': {const box=b.closest('.mx-rv'); const p=RV.pendentes(RV.e()).find(x=>x.u===box.dataset.u); if(!p) return; const n=RV.adiar(p); abertoRev=null; aviso((U(p.u)||{}).as+' foi para '+dd(n),'calendar-days'); return depoisRev();}
    case 'rv-undo': RV.desfazer(b.dataset.k); return render();
    case 'sec': planoAberto[b.dataset.id]=b.getAttribute('aria-expanded')!=='true'; return render();
    case 'fim': {dia(s).fim=1; salvar(s); T.zerar(); foco=null; render(); window.scrollTo({top:0,behavior:'smooth'}); return;}
    case 'fim-undo': {delete dia(s).fim; salvar(s); return render();}
    case 'antigo': return antigo(b.dataset.aba);
    default: if(window.__estudo&&window.__estudo.acao) window.__estudo.acao(a,b,ev);
  }
}
/* revisão: quando a última do dia fecha, o "Agora" segue para a próxima etapa */
function depoisRev(){if(aba==='hoje'&&foco==='rev'){const et=plano(S()).ets.find(e=>e.id==='rev');if(!et||!et.rev.length)return avancar();}render();}
/* depois de concluir uma etapa, o "Agora" pula para a próxima não feita */
function avancar(){foco=null;render();const f=document.querySelector('.mx-foco');if(f)f.scrollIntoView({behavior:'smooth',block:'start'});}

/* ferramentas antigas: mostra o Mentor de antes com um botão de volta */
function antigo(id){
  document.body.classList.add('mx-velho');
  try{ if(typeof abrirAba==='function') abrirAba(id); }catch(_){}
  window.scrollTo(0,0);
}
function voltar(){document.body.classList.remove('mx-velho');render();}

/* ================================================================ estilos */
const CSS=`
body.mx-on>header.topo,body.mx-on>main{display:none}
body.mx-on.mx-velho>header.topo,body.mx-on.mx-velho>main{display:block}
body.mx-on.mx-velho #mx-topo,body.mx-on.mx-velho #mx-app,body.mx-on.mx-velho #mx-nav{display:none}
#mx-voltar{display:none}
body.mx-velho #mx-voltar{display:flex;position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:60;align-items:center;gap:8px;padding:12px 18px;border-radius:999px;border:0;background:var(--acc);color:#04130d;font-weight:800;box-shadow:0 10px 30px rgba(0,0,0,.45);cursor:pointer}
:root{--mx-vi:#a78bfa;--mx-cy:#22d3ee;--mx-am:#fbbf24;--mx-ro:#fb7185;--mx-em:#34d399;--mx-sk:#38bdf8;--mx-pk:#f472b6;--mx-gr:#94a3b8}
.mx-ic{width:18px;height:18px;flex:none;display:inline-block}.mx-ic svg{width:100%;height:100%;display:block}
#mx-topo{position:sticky;top:0;z-index:40;background:rgba(11,15,26,.86);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:.5px solid var(--line);padding-top:env(safe-area-inset-top,0px)}
.mx-topo-in{max-width:1080px;margin:0 auto;height:60px;padding:0 16px;display:flex;align-items:center;gap:14px}
.mx-marca{all:unset;display:flex;align-items:center;gap:10px;cursor:pointer;min-width:0}
.mx-logo{width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,var(--acc),var(--acc2));display:grid;place-items:center;font-weight:900;color:var(--bg);font-size:16px;flex:none;box-shadow:0 4px 12px rgba(16,185,129,.3)}
.mx-marca-t{display:flex;flex-direction:column;line-height:1.15;min-width:0}.mx-marca-t b{font-size:15px}.mx-marca-t i{font-style:normal;font-size:12px;color:var(--soft)}
.mx-abas{display:none;margin-left:12px;gap:2px}
.mx-aba{all:unset;cursor:pointer;display:flex;align-items:center;gap:7px;padding:8px 12px;border-radius:10px;color:var(--soft);font-weight:600;font-size:14px}
.mx-aba:hover{background:var(--hover);color:var(--fg)}.mx-aba[aria-current=page]{background:rgba(16,185,129,.12);color:var(--acc400)}
.mx-aba .mx-ic{width:16px;height:16px}
.mx-relogio{margin-left:auto;all:unset;margin-left:auto;cursor:pointer;display:flex;align-items:center;gap:7px;padding:8px 12px;border-radius:999px;border:1px solid var(--border);background:var(--card);font:600 14px/1 var(--mono);color:var(--soft)}
.mx-sync{margin-left:auto;display:flex;align-items:center;gap:4px;font-size:12px;font-weight:700;color:var(--amber400);background:rgba(245,158,11,.12);padding:5px 9px;border-radius:999px}.mx-sync .mx-ic{width:13px;height:13px}
.mx-sync:not([hidden])+.mx-relogio{margin-left:0}
.mx-relogio.on{border-color:var(--acc);color:var(--acc400);box-shadow:0 0 0 3px rgba(16,185,129,.15)}
.mx-relogio .mx-ic{width:15px;height:15px}
.mx-cfg{all:unset;cursor:pointer;width:38px;height:38px;display:grid;place-items:center;border-radius:11px;color:var(--soft);flex:none}.mx-cfg:hover{background:var(--hover)}.mx-cfg[aria-current=page]{color:var(--acc400);background:rgba(16,185,129,.12)}
#mx-app{max-width:760px;margin:0 auto;padding:16px 16px calc(96px + env(safe-area-inset-bottom,0px))}
#mx-nav{position:fixed;left:0;right:0;bottom:0;z-index:40;display:grid;grid-template-columns:repeat(5,1fr);background:rgba(11,15,26,.94);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:.5px solid var(--line);padding-bottom:env(safe-area-inset-bottom,0px)}
#mx-nav button{all:unset;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 0 8px;font-size:11px;font-weight:600;color:var(--muted)}
#mx-nav button[aria-current=page]{color:var(--acc400)}
#mx-nav .mx-ic{width:22px;height:22px}
@media (min-width:900px){.mx-abas{display:flex}#mx-nav{display:none}#mx-app{padding-bottom:48px}}
@media (min-width:1100px){#mx-app[data-aba=hoje]{max-width:1120px}.mx-grade{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:22px;align-items:start}.mx-grade>aside{position:sticky;top:72px}.mx-grade .mx-lt i{max-width:220px}}
.mx-rot{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:700}
.mx-hero{display:flex;gap:16px;align-items:center;padding:18px;border-radius:18px;background:radial-gradient(120% 140% at 0% 0%,rgba(16,185,129,.16),transparent 60%),var(--card);border:1px solid var(--border)}
.mx-hero h1{font-size:24px;font-weight:850;margin:2px 0 2px;letter-spacing:-.02em}
.mx-hero-txt{flex:1;min-width:0}.mx-sub{margin:0 0 8px;color:var(--soft);font-size:14px}
.mx-hero-anel{position:relative;width:72px;height:72px;flex:none}.mx-hero-anel b{position:absolute;inset:0;display:grid;place-items:center;font-size:20px;font-weight:850}.mx-hero-anel b i{font-style:normal;font-size:12px;color:var(--muted);margin-left:1px}
.mx-anel-f{fill:none;stroke:var(--border);stroke-width:7}.mx-anel-v{fill:none;stroke:var(--acc400);stroke-width:7;stroke-linecap:round;transition:stroke-dashoffset .6s ease}
.mx-barra{height:8px;border-radius:99px;background:var(--border);overflow:hidden}.mx-barra i{display:block;height:100%;border-radius:99px;background:var(--soft);transition:width .5s}
.mx-barra i.em{background:linear-gradient(90deg,var(--acc),var(--acc400))}.mx-barra i.cy{background:var(--mx-cy)}.mx-barra i.am{background:var(--mx-am)}.mx-barra i.ro{background:var(--mx-ro)}
.mx-horas{display:flex;align-items:center;gap:6px;margin:12px 0 0;flex-wrap:wrap}.mx-horas>span{font-size:13px;color:var(--soft);margin-right:4px}
.mx-horas button{all:unset;cursor:pointer;padding:7px 14px;border-radius:999px;border:1px solid var(--border);font-weight:700;font-size:13px;color:var(--soft)}
.mx-horas button[aria-pressed=true]{background:var(--acc);border-color:var(--acc);color:#04130d}
.mx-horas.mini{margin:0}.mx-horas.mini button{padding:5px 9px;font-size:12px}
.mx-status{display:flex;gap:10px;align-items:flex-start;margin:12px 0 0;padding:11px 13px;border-radius:12px;font-size:13.5px;line-height:1.45}
.mx-status.ok{background:rgba(16,185,129,.09);color:var(--acc400)}.mx-status.warn{background:rgba(245,158,11,.1);color:var(--amber400)}
.mx-status .mx-ic{margin-top:1px}
.mx-h2{display:flex;align-items:baseline;justify-content:space-between;margin:26px 2px 10px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--soft);font-weight:800}.mx-h2 i{font-style:normal;text-transform:none;letter-spacing:0;color:var(--muted);font-weight:600}
.mx-foco{border-radius:18px;background:var(--card);border:1px solid var(--border);padding:16px;--c:var(--acc400);border-top:3px solid var(--c)}
.mx-foco.vi{--c:var(--mx-vi)}.mx-foco.cy{--c:var(--mx-cy)}.mx-foco.am{--c:var(--mx-am)}.mx-foco.ro{--c:var(--mx-ro)}.mx-foco.em{--c:var(--mx-em)}.mx-foco.sk{--c:var(--mx-sk)}.mx-foco.pk{--c:var(--mx-pk)}.mx-foco.gr{--c:var(--mx-gr)}
.mx-fcab{display:flex;gap:12px;align-items:center;margin-bottom:10px}.mx-fcab h3{font-size:19px;font-weight:800;line-height:1.25;margin-top:2px}.mx-fcab>div{flex:1;min-width:0}
.mx-fic{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--c) 16%,transparent);color:var(--c);flex:none}.mx-fic .mx-ic{width:20px;height:20px}
.mx-feito{display:flex;align-items:center;gap:4px;font-size:12px;font-weight:800;color:var(--acc400);background:rgba(16,185,129,.12);padding:4px 9px;border-radius:999px}.mx-feito .mx-ic{width:14px;height:14px}
.mx-porque{display:flex;gap:9px;align-items:flex-start;font-size:13.5px;color:var(--soft);background:var(--bg2);border-radius:12px;padding:10px 12px;margin:0 0 12px;line-height:1.45}.mx-porque .mx-ic{color:var(--c,var(--acc400));margin-top:1px;width:16px;height:16px}
.mx-crono{border:1px solid var(--border);border-radius:14px;padding:12px 14px;margin:0 0 14px;display:grid;grid-template-columns:1fr auto;gap:8px 14px;align-items:center}
.mx-crono .mx-barra{grid-column:1/-1;height:6px;order:3}
.mx-crono-v{display:flex;align-items:baseline;gap:8px}.mx-crono-v span{font:800 28px/1 var(--mono);letter-spacing:-.02em}.mx-crono-v i{font-style:normal;color:var(--muted);font-size:13px}
.mx-crono.on{border-color:var(--c,var(--acc));box-shadow:0 0 0 3px color-mix(in srgb,var(--c,var(--acc)) 15%,transparent)}.mx-crono.on .mx-crono-v span{color:var(--c,var(--acc400))}
.mx-btn{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:11px 16px;border-radius:12px;background:var(--acc);color:#04130d;font-weight:800;font-size:14px;min-height:44px;text-align:center}
.mx-btn:hover{filter:brightness(1.08)}.mx-btn.sec{background:transparent;color:var(--fg);border:1px solid var(--border)}.mx-btn.sec:hover{background:var(--hover)}
.mx-btn .mx-ic{width:16px;height:16px}
.mx-acoes{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.mx-passos{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.mx-passos>li{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px dashed var(--border)}.mx-passos>li:last-child{border-bottom:0}
.mx-passos>li>div{flex:1;min-width:0}.mx-passos b{font-size:15px}.mx-passos p{margin:3px 0 0;font-size:13.5px;color:var(--soft);line-height:1.45}
.mx-passos>li.ok>div>b{text-decoration:line-through;color:var(--muted)}
.mx-pm{margin-left:8px;font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap}
.mx-chk{all:unset;box-sizing:border-box;cursor:pointer;width:30px;height:30px;border-radius:999px;border:2px solid var(--border);display:grid;place-items:center;font-weight:800;font-size:13px;color:var(--soft);flex:none;margin-top:-3px}
.mx-chk[aria-pressed=true]{background:var(--c,var(--acc));border-color:var(--c,var(--acc));color:#04130d}.mx-chk .mx-ic{width:15px;height:15px}
.mx-simples{margin:0 0 4px;padding-left:20px;display:flex;flex-direction:column;gap:9px;font-size:14.5px;line-height:1.5}
.mx-pdf{display:flex;gap:10px;align-items:center;margin:9px 0 0;padding:10px 12px;border-radius:12px;background:var(--bg2);border:1px solid var(--border)}
.mx-pdf .mx-ic{color:var(--mx-ro)}.mx-pdf>span{display:flex;flex-direction:column;min-width:0}.mx-pdf b{font-size:13.5px;overflow-wrap:anywhere}.mx-pdf i{font-style:normal;font-size:11.5px;color:var(--muted);overflow-wrap:anywhere}
.mx-vid{margin-top:9px;font-size:13.5px}.mx-vid summary{cursor:pointer;display:flex;align-items:center;gap:6px;color:var(--soft);font-weight:600}.mx-vid ul{margin:6px 0 0;padding-left:22px}.mx-vid a{color:var(--mx-cy)}
.mx-extra{margin-top:4px}
.mx-dica{display:block;font-size:12.5px;color:var(--muted);margin:7px 0 0;line-height:1.45}.mx-dica .mx-ic{width:14px;height:14px;vertical-align:-2px;margin-right:4px}
.mx-pedir{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:6px;margin:8px 8px 0 0;font-size:13px;font-weight:700;color:var(--mx-vi)}.mx-pedir .mx-ic{width:15px;height:15px}
.mx-in{box-sizing:border-box;padding:11px 12px;border-radius:10px;border:1px solid var(--border);background:var(--bg2);color:var(--fg);font:inherit;font-size:16px;min-width:0;min-height:44px}
.mx-in:focus{outline:none;border-color:var(--acc)}
.mx-num{width:76px;text-align:center}
.mx-res{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid var(--border);font-weight:700}.mx-res .mx-btn{margin-left:auto}
.mx-erro{display:grid;grid-template-columns:1fr;gap:7px;margin-top:8px}
@media (min-width:600px){.mx-erro{grid-template-columns:1fr 1fr auto}}
.mx-erros{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:6px;font-size:13.5px}
.mx-erros li{display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border-radius:10px;background:var(--bg2)}.mx-erros li>span{flex:1;min-width:0}.mx-erros i{font-style:normal;color:var(--muted)}
.mx-erros.grande li>span i:first-child{display:block;font-size:12px}
.mx-erros button,.mx-feitas button{all:unset;cursor:pointer;color:var(--muted);padding:2px}.mx-erros button .mx-ic,.mx-feitas button .mx-ic{width:15px;height:15px}
.mx-ok{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin-top:14px;padding:12px;border-radius:12px;background:rgba(16,185,129,.09);color:var(--acc400);font-weight:700;font-size:14px}.mx-ok>span{flex:1;min-width:180px}
.mx-ok .mx-btn{color:var(--fg)}
.mx-linha{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.mx-linha button{all:unset;box-sizing:border-box;cursor:pointer;width:100%;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:var(--card);border:1px solid var(--border);--c:var(--acc400)}
.mx-linha li.vi button{--c:var(--mx-vi)}.mx-linha li.cy button{--c:var(--mx-cy)}.mx-linha li.am button{--c:var(--mx-am)}.mx-linha li.ro button{--c:var(--mx-ro)}.mx-linha li.em button{--c:var(--mx-em)}.mx-linha li.sk button{--c:var(--mx-sk)}.mx-linha li.pk button{--c:var(--mx-pk)}.mx-linha li.gr button{--c:var(--mx-gr)}
.mx-linha li.atual button{border-color:var(--c);box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 14%,transparent)}
.mx-linha li.ok button{opacity:.6}.mx-linha li.ok .mx-lt b{text-decoration:line-through}
.mx-n{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:color-mix(in srgb,var(--c,var(--acc400)) 15%,transparent);color:var(--c,var(--acc400));flex:none;font-weight:800;font-size:11px}
.mx-linha li.ok .mx-n{background:var(--acc);color:#04130d}.mx-n .mx-ic{width:17px;height:17px}
.mx-lt{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}.mx-lt b{font-size:14.5px}.mx-lt i{font-style:normal;font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mx-lm{display:flex;flex-direction:column;align-items:flex-end;font:700 13px/1.3 var(--mono);color:var(--soft);white-space:nowrap}.mx-lm em{font:600 11px/1.3 system-ui;color:var(--acc400);font-style:normal}
.mx-nota{display:flex;gap:8px;font-size:12.5px;color:var(--muted);margin:18px 2px 0;line-height:1.5}.mx-nota .mx-ic{width:15px;height:15px;margin-top:2px}
.mx-intro{border-radius:18px;padding:16px;margin-bottom:14px;background:linear-gradient(135deg,rgba(167,139,250,.14),rgba(34,211,238,.08));border:1px solid rgba(167,139,250,.35)}
.mx-intro>b{display:flex;gap:8px;align-items:center;font-size:16px}.mx-intro ol{margin:10px 0 12px;padding-left:20px;display:flex;flex-direction:column;gap:7px;font-size:14px;line-height:1.5}
.mx-cumprida{display:flex;gap:14px;align-items:center;margin:14px 0 0;padding:16px;border-radius:16px;background:linear-gradient(135deg,rgba(251,191,36,.16),rgba(16,185,129,.12));border:1px solid rgba(251,191,36,.35);animation:entra .4s ease}
.mx-cumprida>.mx-ic{width:34px;height:34px;color:var(--amber400)}.mx-cumprida b{font-size:17px}.mx-cumprida p{margin:2px 0 0;font-size:13.5px;color:var(--soft)}
.mx-espera{display:flex;gap:12px;padding:12px;border-radius:12px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);margin-top:10px}.mx-espera .mx-ic{color:var(--amber400);margin-top:2px}.mx-espera p{margin:4px 0 0;font-size:13.5px;color:var(--soft)}
.mx-meta{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
.mx-chip{display:inline-flex;align-items:center;font-size:11.5px;font-weight:800;padding:3px 9px;border-radius:999px;background:var(--hover);color:var(--soft);white-space:nowrap}
.mx-chip.em{background:rgba(16,185,129,.13);color:var(--acc400)}.mx-chip.am{background:rgba(245,158,11,.13);color:var(--amber400)}
.mx-fprog{display:grid;gap:6px;margin:12px 0;font-size:13px;color:var(--soft)}.mx-fprog i{font-style:normal;color:var(--muted);font-size:12.5px}
.mx-rv{border:1px solid var(--border);border-radius:14px;margin:8px 0;background:var(--bg2)}.mx-rv.aberto{border-color:var(--mx-ro)}
.mx-rv-top{all:unset;box-sizing:border-box;cursor:pointer;width:100%;display:flex;align-items:center;gap:10px;padding:12px}
.mx-rv-n{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.mx-rv-n b{font-size:14.5px}.mx-rv-n i{font-style:normal;font-size:12.5px;color:var(--muted)}
.mx-fx{font-size:10.5px;font-weight:850;border-radius:999px;padding:3px 8px;white-space:nowrap}.mx-fx.f1{background:rgba(239,68,68,.15);color:var(--red400)}.mx-fx.f2{background:rgba(245,158,11,.15);color:var(--amber400)}.mx-fx.f3{background:rgba(148,163,184,.15);color:var(--muted)}
.mx-seta{transition:transform .15s;color:var(--muted)}[aria-expanded=true] .mx-seta{transform:rotate(180deg)}
.mx-rv-c{padding:0 12px 12px}
.mx-feitas{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}.mx-feitas li{display:flex;gap:8px;align-items:center;font-size:13.5px;color:var(--soft)}.mx-feitas li>.mx-ic{color:var(--acc400);width:16px;height:16px}.mx-feitas li span{flex:1}
.mx-cab{margin:6px 2px 14px}.mx-cab h1{font-size:26px;font-weight:850;letter-spacing:-.02em}.mx-cab p{color:var(--soft);font-size:14px;margin-top:4px;line-height:1.5}
.mx-card{border-radius:16px;background:var(--card);border:1px solid var(--border);padding:14px 16px;margin-bottom:12px}
.mx-h3{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:800;margin:0 0 8px}.mx-h3 i{margin-left:auto;font-style:normal;color:var(--muted);font-weight:600;font-size:13px}.mx-h3 .mx-ic{color:var(--acc400);width:17px;height:17px}
.mx-vazio{color:var(--muted);font-size:13.5px;margin:4px 0}
.mx-prox{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px;font-size:13.5px}.mx-prox li{display:grid;grid-template-columns:110px 1fr;gap:8px}.mx-prox b{white-space:nowrap}
.mx-resumo{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.mx-resumo>div{display:flex;flex-direction:column;gap:5px;min-width:0}.mx-resumo b{font-size:24px;font-weight:850;display:flex;align-items:baseline;gap:3px}.mx-resumo b i{font-style:normal;font-size:13px;color:var(--muted);font-weight:700}.mx-resumo b .mx-ic{width:18px;height:18px;color:var(--amber400)}
.mx-sec{all:unset;box-sizing:border-box;cursor:pointer;width:100%;display:flex;align-items:center;gap:10px}.mx-sec>span{flex:1;display:flex;flex-direction:column}.mx-sec b{font-size:15px}.mx-sec i{font-style:normal;font-size:12.5px;color:var(--muted)}
.mx-lista{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column}
.mx-lista li{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--border)}
.mx-lista li .mx-n{width:30px;height:30px;font-size:10.5px}.mx-lista li.ok .mx-n{background:var(--acc);color:#04130d}.mx-lista li.ok .mx-lt b{color:var(--muted)}
.mx-lista li.atual{background:linear-gradient(90deg,rgba(16,185,129,.1),transparent);margin:0 -16px;padding:9px 16px}
.mx-lista .mx-lt i{white-space:normal}
.mx-mini{all:unset;cursor:pointer;font-size:12px;font-weight:700;color:var(--soft);border:1px solid var(--border);border-radius:999px;padding:5px 10px;white-space:nowrap}.mx-mini .mx-ic{width:14px;height:14px;display:block}
.mx-cob{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.mx-cob-anel{position:relative;width:120px;height:120px;flex:none}.mx-cob-anel b{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:24px;font-weight:850}.mx-cob-anel b i{font-style:normal;font-size:11px;color:var(--muted);font-weight:700;max-width:80px;text-align:center;line-height:1.2}
.mx-cob-t{flex:1;min-width:200px;font-size:14px;color:var(--soft);line-height:1.5}
.mx-barras{position:relative;display:grid;grid-template-columns:repeat(14,1fr);gap:5px;height:140px;align-items:end;padding-bottom:20px}
.mx-barras>div{position:relative;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center}.mx-barras>div i{width:100%;border-radius:6px 6px 2px 2px;background:var(--border);min-height:3px}
.mx-barras i.meio{background:var(--mx-am)}.mx-barras i.ok{background:var(--acc400)}.mx-barras>div span{position:absolute;bottom:-18px;font-size:10.5px;color:var(--muted)}.mx-barras>div.hoje span{color:var(--fg);font-weight:800}
.mx-barras hr{position:absolute;left:0;right:0;margin:0;border:0;border-top:1px dashed rgba(52,211,153,.5);transform:translateY(-20px)}
.mx-mats{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}.mx-mats li{display:grid;grid-template-columns:minmax(0,1fr) 90px 44px;gap:10px;align-items:center;font-size:13.5px}.mx-mats li b{text-align:right;font-family:var(--mono);font-size:13px}
.mx-hsem{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}.mx-hsem li{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.mx-hsem li>span{font-size:14px;min-width:70px}
.mx-atalhos{display:flex;flex-direction:column;gap:6px}.mx-atalhos a,.mx-atalhos button{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:10px;padding:12px;border-radius:12px;border:1px solid var(--border);font-size:14px;font-weight:600}.mx-atalhos a:hover,.mx-atalhos button:hover{background:var(--hover)}
.mx-mais{all:unset;cursor:pointer;display:block;margin:10px auto 0;font-size:13px;font-weight:700;color:var(--acc400)}
.mx-versao{text-align:center;font-size:11.5px;color:var(--muted);margin-top:18px}
.mx-amanha{margin:6px 0 0;padding-left:18px;color:var(--soft);font-size:13.5px}
.mx-sem{margin:8px 0 0;font-size:12.5px;color:var(--muted)}.mx-sem b{color:var(--fg)}
.mx-parei{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:9px;font-size:13px;color:var(--soft)}
.mx-chip.cy{background:rgba(34,211,238,.12);color:var(--mx-cy)}
@media (max-width:420px){.mx-hero{padding:14px;gap:12px}.mx-hero h1{font-size:21px}.mx-resumo b{font-size:20px}.mx-prox li{grid-template-columns:1fr}.mx-mats li{grid-template-columns:minmax(0,1fr) 70px 40px}.mx-marca-t i{font-size:11px}}
`;

/* ================================================================ partida */
function montar(){
  const st=document.createElement('style'); st.id='mx-css'; st.textContent=CSS; document.head.appendChild(st);
  topo=document.createElement('header'); topo.id='mx-topo';
  app=document.createElement('div'); app.id='mx-app'; app.setAttribute('role','main'); app.setAttribute('aria-live','polite');
  nav=document.createElement('nav'); nav.id='mx-nav'; nav.setAttribute('aria-label','Seções');
  const vb=document.createElement('button'); vb.id='mx-voltar'; vb.innerHTML=I('arrow-left')+'Voltar para a Missão'; vb.onclick=voltar;
  document.body.prepend(topo); topo.after(app); document.body.appendChild(nav); document.body.appendChild(vb);
  document.body.classList.add('mx-on');
  app.innerHTML='<section class="mx-hero"><div class="mx-hero-txt"><span class="mx-rot">Missão de hoje</span><h1>Montando o seu dia…</h1></div></section>';
  [topo,app,nav].forEach(el=>el.addEventListener('click',clique));
  app.addEventListener('change',ev=>{const el=ev.target;if(el.dataset&&el.dataset.parei){const s=S();const v=parseInt(el.value,10);if(v>0)s.fpg[el.dataset.parei]=v;else delete s.fpg[el.dataset.parei];salvar(s);aviso(v>0?'Guardado: página '+v:'Apagado','check');render();}});
  app.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&ev.target.matches('.mx-in')){const box=ev.target.closest('.mx-erro');if(box){ev.preventDefault();box.querySelector('[data-acao=erro]').click();}}});
  setInterval(()=>{T.passo();const t=T.ler();
    document.querySelectorAll('[data-crono]').forEach(el=>{const tt=T.doId(el.dataset.crono);el.textContent=mmss(T.ms(tt));});
    const r=document.querySelector('[data-relogio]'); if(r&&t&&t.ini) r.textContent=mmss(T.ms(t));},1000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){T.passo();render();} else {Object.keys(SYNC.pend).forEach(k=>{clearTimeout(SYNC.tm[k]);enviar(k);});}});
  window.addEventListener('hashchange',()=>{const a=(location.hash||'').replace('#m-','');if(ABAS_OK.includes(a)&&a!==aba){aba=a;render();}});
}
async function carregar(){
  const v=window.__REV2_V||VERSAO;
  const [m,r]=await Promise.all([fetch('/mentor/missao.json?v='+v,{cache:'no-cache'}).then(x=>x.ok?x.json():null),fetch('/mentor/revisao_v2.json?v='+v,{cache:'no-cache'}).then(x=>x.ok?x.json():null)]);
  if(!m||!r){app.innerHTML='<section class="mx-card"><b>Não consegui carregar o plano.</b><p class="mx-dica">Recarregue a página. Se continuar, use Mais → Ferramentas antigas.</p></section>';return;}
  MJ=m; RJ=r; reconciliar();
  const s=S(); if(s.cfg&&s.cfg.chegou) Object.keys(s.cfg.chegou).forEach(id=>{const f=MJ.fichas.find(x=>x.id===id);if(f&&!f.arq)f.arq='(ficha recebida no chat)';});
  iniciarEstado(); render();
}
window.__mx={esc,I,chip,barra,anel,dd,dLonga,add,entre,fmtM,mmss,plural,pct,pctTxt,cap,semana,gravarK,lerK,aviso,copiar,U,RV,ER,S,salvar,dia,HOJE,filaT,fichaDaVez,
  get MJ(){return MJ;}, get RJ(){return RJ;}, render:()=>render(), ir:a=>ir(a), plano:()=>plano(S()), depoisRev:()=>depoisRev(),
  marcar:id=>{const s=S();dia(s).ok[id]=1;salvar(s);}};
montar(); carregar().catch(e=>{console.error(e);app.innerHTML='<section class="mx-card"><b>Deu erro ao montar a missão.</b><p class="mx-dica">'+esc(e.message)+'</p></section>';});
window.__missao={render,S,RV,ER,plano:()=>plano(S()),T,versao:VERSAO};
})();
