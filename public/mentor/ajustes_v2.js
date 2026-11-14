/* Mike Mentor · ajustes gerais (14/11/2026), carregado depois do revisao_v2.js
   - Início abre com "Seu dia, nesta ordem": 1 revisão, 2 aula nova, 3 Anki.
   - "O método" fica recolhido (abre pelo link); tarefas do cronograma vêm fechadas; some o "exemplo" com dados falsos.
   - Cronômetro não conta minuto com o computador parado (sem mexer há 20 min, fora do vídeo), e o gráfico
     limita cada dia a 8h (havia dias de 19h porque a aba ficava aberta na VPS).
   - Textos do "card do erro" passam a dizer que o erro vai para a lista do Anki. */
(function(){
'use strict';
const CHAVE='mm3_dia';
const TETO_DIA=480, OCIOSO=20*60*1000;

/* ---------- cronômetro só conta com gente na frente ---------- */
let ultimaAtividade=Date.now();
['mousemove','mousedown','keydown','scroll','touchstart','wheel'].forEach(ev=>window.addEventListener(ev,()=>{ultimaAtividade=Date.now();},{passive:true,capture:true}));
if(typeof tick==='function'){
  const tick0=tick;
  window.tick=function(){
    const parado=Date.now()-ultimaAtividade>OCIOSO && !(typeof sess!=='undefined'&&sess&&sess.etapa==='video');
    if(parado){ try{ inicioSeg=Date.now(); }catch(_){} return; }
    return tick0.apply(this,arguments);
  };
  try{ if(rodando){ clearInterval(rodando); rodando=setInterval(window.tick,1000); } }catch(_){}
}
if(typeof horasVisiveis==='function'){
  const hv0=horasVisiveis;
  window.horasVisiveis=function(){const h=hv0.apply(this,arguments);const c={};Object.keys(h||{}).forEach(d=>{c[d]=Math.min(h[d]||0,TETO_DIA);});return c;};
}

/* ---------- "Seu dia, nesta ordem" ---------- */
function estDia(){const e=ler(CHAVE,null)||{};return e[HOJE]||{};}
function marcarAnki(v){const e=Object.assign({},ler(CHAVE,null)||{});e[HOJE]=Object.assign({},e[HOJE]||{},{anki:v?1:0});
  Object.keys(e).sort().slice(0,-40).forEach(k=>delete e[k]); gravar(CHAVE,e);}
function aulaDaVez(){
  try{ const l=(window.__H||[]); const i=(typeof sess!=='undefined'&&sess&&!sess.fim)?sess.aula:l.findIndex(a=>!a.feita); return l[i]||l.find(a=>!a.feita)||null; }catch(_){ return null; }
}
function seuDia(){
  const p=document.getElementById('p-inicio'); if(!p) return;
  let box=document.getElementById('seu-dia');
  if(!box){box=document.createElement('div');box.id='seu-dia';box.className='card painel';p.insertBefore(box,p.firstChild);}
  const r=window.__rev2&&window.__rev2.resumo?window.__rev2.resumo():null;
  const nRev=r?r.lista.length:null; const revOk=r&&!nRev;
  const al=aulaDaVez(); const aulasOk=!al;
  const anki=!!estDia().anki;
  const passo=(n,ok,titulo,sub,botao)=>`<li class="${ok?'ok':''}"><span class="sd-n">${ok?I('check'):n}</span><div><b>${titulo}</b><span class="muted small">${sub}</span></div>${botao||''}</li>`;
  const html=`<div class="painel-cab"><h3>${I('list-checks')}Seu dia, nesta ordem</h3><button type="button" class="voltar" id="sd-metodo">${document.getElementById('metodo')?.classList.contains('sd-aberto')?'Esconder como funciona a aula':'Como funciona a aula'}</button></div>
    <ol class="sd-passos">
      ${passo(1,revOk,'Revisão',r?(nRev?`${nRev} assunto${nRev>1?'s':''} · cerca de ${fmtMin(r.min)}`:'Nada para revisar hoje'):'carregando…',r&&nRev?`<button class="btn sec" data-sd="rev">${I('rotate-ccw')}Abrir</button>`:'')}
      ${passo(2,aulasOk,'Aula nova',al?`${esc(al.assunto||al.nome||al.titulo||'')}${al.mat?' · '+esc(al.mat):''}`:'Aulas de hoje feitas',al?`<button class="btn sec" data-sd="aula">${I('play')}Ir</button>`:'')}
      ${passo(3,anki,'Anki','Os cards do dia no app do Anki, 10 a 15 min',`<button class="btn sec" data-sd="anki" aria-pressed="${anki}">${anki?'Desfazer':'Fiz'}</button>`)}
    </ol>`;
  if(box.__html!==html){box.__html=html;box.innerHTML=html;
    box.querySelectorAll('[data-sd]').forEach(b=>b.onclick=()=>{const a=b.dataset.sd;
      if(a==='rev') abrirAba('revisao');
      if(a==='aula'){const ag=document.getElementById('agora');if(ag)ag.scrollIntoView({behavior:'smooth',block:'start'});}
      if(a==='anki'){marcarAnki(!estDia().anki);toast(estDia().anki?'Anki do dia feito':'Desmarcado','check');seuDia();}
    });
    const bm=box.querySelector('#sd-metodo'); if(bm) bm.onclick=()=>{const m=document.getElementById('metodo');if(!m)return;m.classList.toggle('sd-aberto');if(m.classList.contains('sd-aberto'))m.scrollIntoView({behavior:'smooth',block:'start'});seuDia();};
  }
}

/* ---------- arrumação do Início depois de cada desenho ---------- */
const TROCAS=[
  ['Uma linha por erro: vira card de Certo/Errado (como a prova) e a questão volta no fechamento do dia.','Uma linha por erro: entra na lista que vira card de Anki.'],
  ['uma linha por erro','uma linha por erro, vai para o Anki'],
];
function arrumar(){
  const p=document.getElementById('p-inicio'); if(!p||p.hidden) return;
  const t=document.getElementById('tarefas-dia'); if(t&&!t.dataset.sd){t.dataset.sd='1';t.open=false;}
  const w=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let n;
  while((n=w.nextNode())){for(const [a,b] of TROCAS){if(n.nodeValue.trim()===a)n.nodeValue=n.nodeValue.replace(a,b);}}
  seuDia();
}
let agendado=null;
const obs=new MutationObserver(()=>{if(agendado)return;agendado=requestAnimationFrame(()=>{agendado=null;try{arrumar();}catch(_){}});});
const pi=document.getElementById('p-inicio'); if(pi) obs.observe(pi,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
document.querySelectorAll('[role=tab],.aba').forEach(a=>a.addEventListener('click',()=>setTimeout(()=>{try{arrumar();}catch(_){}},50)));

const css=document.createElement('style');
css.textContent=`
#metodo:not(.sd-aberto){display:none!important}
#p-inicio label.exemplo{display:none}
#seu-dia{margin-bottom:16px}
.sd-passos{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.sd-passos li{display:flex;align-items:center;gap:10px;border:1px solid var(--border);border-radius:12px;padding:10px 12px}
.sd-passos li>div{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.sd-passos li.ok{opacity:.65}
.sd-passos li.ok b{text-decoration:line-through}
.sd-n{width:26px;height:26px;border-radius:999px;display:grid;place-items:center;font-weight:800;font-size:13px;background:rgba(16,185,129,.15);color:var(--acc400);flex:none}
.sd-n .ic{width:14px;height:14px}
.sd-passos .btn{padding:6px 10px;font-size:12px}
`;
document.head.appendChild(css);
try{arrumar();}catch(_){}
setTimeout(()=>{try{seuDia();}catch(_){}},1500); /* depois que o calendário da revisão carrega */
})();
