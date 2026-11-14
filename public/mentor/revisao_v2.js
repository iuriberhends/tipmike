/* Mike Mentor · Revisão v2 (14/11/2026)
   A revisão deixa de ser R1/R7/R30 por aula (com questão do Gran que às vezes não tem nada a ver)
   e passa a seguir o calendário por incidência: o que mais cai volta mais vezes.
   Cada revisão: lembrar sem olhar -> questões no caderno do TEC daquele assunto -> acertos -> erros anotados.
   Os cards ficam no Anki (escolha de Santos em 14/11): o Mentor só guarda a lista de erros, que vira card de Anki.
   Carregado depois do __APP; usa HOJE, ler, gravar, esc, I, toast, addDias, fmtData, curta, HOJE_REV. */
(function(){
'use strict';
const CHAVE='mm3_rev2';
const PASTA_TEC='https://www.tecconcursos.com.br/questoes/pastas/7734002';
const FILTRO_TEC='https://www.tecconcursos.com.br/questoes/filtrar';
let R=null, aberto=null, verTodas=false, carregou=false;

/* ---------- estado salvo no banco (mentor.config, via /proto/estado) ---------- */
function est(){
  const e=Object.assign({},ler(CHAVE,null)||{});
  e.f=e.f||{};   /* feitas: chave -> [acertos,total,dia] */
  e.x=e.x||[];   /* extras: [dia, unidade, minutos, 'x'] */
  e.ad=e.ad||{}; /* adiadas: chave -> novo dia */
  e.ds=e.ds||{}; /* dispensadas: chave -> 1 */
  e.tec=e.tec||{}; /* link do caderno colado por você: unidade -> url */
  e.er=e.er||[]; /* erros: [dia, unidade, o que errei, frase certa, enviado(0/1)] */
  return e;
}
function salvar(e){gravar(CHAVE,e);}
function iniciar(){const e=est();if(!e.ini){e.ini=HOJE;salvar(e);}return e;}

const U=id=>R.unidades.find(u=>u.id===id)||{};
const chave=it=>it[0]+'|'+it[1]+(it[3]==='x'?'|x':'');
const fimDeSemana=d=>{const w=dt(d).getDay();return w===0?addDias(d,1):d;}; /* domingo é livre */
function itens(e){
  return R.agenda.concat(e.x).filter(it=>it[0]>=e.ini).map(it=>{const k=chave(it);return {k,d:e.ad[k]||it[0],u:it[1],min:it[2],tipo:it[3]};});
}
function abertos(e){return itens(e).filter(x=>!e.f[x.k]&&!e.ds[x.k]);}

/* Pendentes até hoje, uma por assunto (a mais recente). As mais antigas do mesmo assunto vão junto. */
function pendentes(e){
  const por={};
  abertos(e).filter(x=>x.d<=HOJE).forEach(x=>{(por[x.u]=por[x.u]||[]).push(x);});
  return Object.values(por).map(l=>{l.sort((a,b)=>a.d<b.d?1:-1);return Object.assign({},l[0],{junto:l.slice(1).map(y=>y.k),desde:l[l.length-1].d});})
    .sort((a,b)=>(U(a.u).f-U(b.u).f)||(pct(U(b.u).pp)-pct(U(a.u).pp)));
}
const pct=s=>parseFloat(String(s||'0').replace('%','').replace(',','.'))||0;
const dias=(a,b)=>Math.round((dt(b)-dt(a))/864e5);

/* ---------- regras depois da revisão ---------- */
function concluir(p,a,t){
  const e=est(); const dia=HOJE; const taxa=t?a/t:0; const u=U(p.u);
  [p.k,...p.junto].forEach(k=>{e.f[k]=[a,t,dia];});
  let msg;
  const futuros=abertos(e).filter(x=>x.u===p.u&&x.d>dia).sort((x,y)=>x.d<y.d?-1:1);
  if(taxa<0.6){
    const volta=fimDeSemana(addDias(dia,3));
    if(!futuros.some(x=>x.d<=volta)) e.x.push([volta,p.u,20,'x']);
    msg=`${Math.round(taxa*100)}%: ${u.as} volta em 3 dias (${fmtData(volta)}) para você fechar o buraco.`;
  }else if(taxa>=0.85&&futuros.length&&dias(dia,futuros[0].d)<=10){
    e.ds[futuros[0].k]=1;
    msg=`${Math.round(taxa*100)}%: mandou bem. A revisão de ${fmtData(futuros[0].d)} desse assunto foi dispensada.`;
  }else{
    msg=`${Math.round(taxa*100)}%: segue o calendário${futuros.length?`; a próxima é ${fmtData(futuros[0].d)}`:''}.`;
  }
  salvar(e); return msg;
}
function adiar(p){
  const e=est(); const nova=fimDeSemana(addDias(HOJE,1));
  [p.k,...p.junto].forEach(k=>{e.ad[k]=nova;}); salvar(e);
  toast(U(p.u).as+' foi para '+fmtData(nova),'calendar-days');
}
function dispensar(p){
  const e=est(); [p.k,...p.junto].forEach(k=>{e.ds[k]=1;}); salvar(e);
  toast('Dispensada. O assunto volta na próxima data do calendário','check');
}

/* ---------- textos ---------- */
const FAIXA={1:['Núcleo','f1','o que mais cai'],2:['Forte','f2','cai bastante'],3:['Manutenção','f3','cai pouco']};
function passoQuestoes(p,e){
  const u=U(p.u); const url=u.tec||e.tec[p.u];
  const n=p.tipo==='q'?'20':(p.tipo==='l'?'5 a 10':'10 a 15');
  let html=`<b>Questões no TEC (${n}).</b> `;
  if(url){
    html+=`<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">${I('external-link')}Abrir o caderno</a>
      <span class="muted small rv2-dica">Continue de onde parou: cada revisão pega as próximas questões do mesmo caderno. Terminou o caderno? Mande refazer só as que você errou.</span>`;
  }else if(u.tecn){
    html+=`<a class="btn" href="${PASTA_TEC}" target="_blank" rel="noopener">${I('external-link')}Abrir a pasta no TEC</a>
      <span class="muted small rv2-dica">Abra o caderno que tem <b>${esc(u.tecn)}</b> no nome.</span>`;
  }else{
    html+=`<a class="btn sec" href="${FILTRO_TEC}" target="_blank" rel="noopener">${I('external-link')}Filtrar no TEC</a>
      <span class="muted small rv2-dica">Esse assunto ainda não tem caderno seu. Peça no chat "monta o caderno de ${esc(u.as)}" que eu monto no TEC, ou filtre por <b>${esc(u.as)}</b>, só PMs, sem anuladas e desatualizadas.</span>`;
  }
  if(!u.tec) html+=`<details class="rv2-link"><summary class="muted small">${e.tec[p.u]?'Trocar o link do caderno':'Já tem o caderno? Cole o link aqui'}</summary>
      <div class="rv2-linha"><input type="url" class="rv2-in" data-tec placeholder="https://www.tecconcursos.com.br/caderno/..." value="${esc(e.tec[p.u]||'')}"><button class="btn sec" data-acao="tec">Guardar</button></div></details>`;
  return html;
}
function corpo(p,e){
  const u=U(p.u);
  const lembrar=p.tipo==='l'?`<b>Leitura final (10 min).</b> Passe os olhos no resumo de bolso ou na ficha, só nas caixas de pegadinha. Foco: ${esc(u.cai)}.`
    :`<b>Lembrar sem olhar (2 min).</b> Fale ou rabisque o que você lembra de: <i>${esc(u.cai)}</i>. Só depois confira na ficha o que faltou.`;
  return `<ol class="rv2-passos">
    <li>${lembrar}</li>
    <li>${passoQuestoes(p,e)}</li>
    <li><b>Quantas acertou?</b><div class="rv2-linha"><input type="number" min="0" max="99" class="rv2-in rv2-num" data-a placeholder="acertos"><span class="muted">de</span><input type="number" min="1" max="99" class="rv2-in rv2-num" data-t placeholder="feitas"><button class="btn" data-acao="concluir">${I('check')}Concluir</button></div>
      <span class="muted small rv2-dica">Abaixo de 60%, o assunto volta em 3 dias. De 85% para cima, a próxima revisão dele fica dispensada.</span></li>
    <li><b>Errou alguma?</b> Uma linha por erro. Eu transformo a lista em cards de Anki.
      <div class="rv2-erro"><input class="rv2-in" data-er maxlength="240" placeholder="O que eu errei. Ex.: achei que o Governador nomeia o juiz militar"><input class="rv2-in" data-ct maxlength="240" placeholder="A frase certa (opcional). Ex.: quem nomeia é o TJ"><button class="btn sec" data-acao="erro">${I('plus')}Anotar erro</button></div>
      ${errosDe(p.u,e)}</li>
  </ol>
  <div class="acoes rv2-acoes"><button class="btn sec" data-acao="adiar">${I('calendar-days')}Deixar para amanhã</button>${p.d<HOJE?`<button class="btn sec" data-acao="dispensar">${I('x')}Dispensar esta</button>`:''}</div>`;
}
function errosDe(uid,e){
  const l=e.er.filter(x=>x[1]===uid&&x[0]===HOJE);
  return l.length?`<ul class="rv2-erros">${l.map(x=>`<li>${esc(x[2])}${x[3]?` <span class="muted">→ ${esc(x[3])}</span>`:''}</li>`).join('')}</ul>`:'';
}
function item(p,e){
  const u=U(p.u); const fx=FAIXA[u.f]||FAIXA[3]; const atraso=dias(p.desde,HOJE);
  const tipo=p.tipo==='q'?'reta final':(p.tipo==='l'?'leitura final':(p.tipo==='x'?'reforço':''));
  return `<div class="rv2-item${aberto===p.u?' aberto':''}" data-u="${p.u}">
    <button type="button" class="rv2-top" aria-expanded="${aberto===p.u}">
      <span class="rv2-f ${fx[1]}" title="${fx[2]}">${fx[0]}</span>
      <span class="rv2-nome"><b>${esc(u.as)}</b><span class="muted small">${esc(u.mat)} · ${esc(u.pp)} da prova · ${p.min} min${tipo?' · '+tipo:''}</span></span>
      ${atraso>0?`<span class="chip amb">${atraso===1?'de ontem':'há '+atraso+' dias'}</span>`:''}
      <span class="rv2-seta">${I('chevron-down')}</span>
    </button>
    ${aberto===p.u?`<div class="rv2-corpo">${corpo(p,e)}</div>`:''}
  </div>`;
}

/* ---------- tela ---------- */
function resumoHoje(){
  if(!R) return null;
  const e=est(); const p=pendentes(e);
  return {lista:p, hoje:p.filter(x=>x.d===HOJE), atras:p.filter(x=>x.d<HOJE), min:p.reduce((a,x)=>a+x.min,0)};
}
function painel(){
  const box=document.getElementById('rev2'); if(!box) return;
  if(!R){box.innerHTML=`<div class="cab"><div><h2>Revisão</h2><p class="muted small">carregando o calendário…</p></div></div>`;return;}
  const e=est(); const s=resumoHoje();
  const prox=[]; for(let i=1;i<=7;i++){const d=addDias(HOJE,i);const l=abertos(e).filter(x=>x.d===d);if(l.length)prox.push([d,l]);}
  const feitas=Object.entries(e.f).filter(([k,v])=>dias(v[2],HOJE)<=28);
  const tot=feitas.reduce((a,[k,v])=>[a[0]+v[0],a[1]+v[1]],[0,0]);
  const ult={}; Object.entries(e.f).sort((a,b)=>a[1][2]<b[1][2]?-1:1).forEach(([k,v])=>{ult[k.split('|')[1]]=v;});
  const fracos=Object.entries(ult).filter(([u,v])=>v[1]&&v[0]/v[1]<0.6).map(([u,v])=>[U(u).as,Math.round(v[0]/v[1]*100)]);
  const pend=e.er.filter(x=>!x[4]);
  const atrasVis=verTodas?s.atras:s.atras.slice(0,5);
  box.innerHTML=`<div class="cab"><div><h2>Revisão</h2><p class="muted small bloco-texto">O que mais cai volta mais vezes. Cada revisão tem quatro passos: lembrar sem olhar, fazer as questões no seu caderno do TEC, anotar os acertos e anotar cada erro em uma linha. Faltou um dia? Nada se perde: fica em "Ficou para trás" e você faz pela ordem.</p></div></div>
  <div class="painel rv2">
    <div class="painel-cab"><h3>${I('rotate-ccw')}1. Revisão de hoje</h3><span class="muted small">${s.lista.length?`${s.lista.length} assunto${s.lista.length>1?'s':''} · cerca de ${fmtMin(s.min)}`:''}</span></div>
    ${s.hoje.length?s.hoje.map(p=>item(p,e)).join(''):`<p class="muted small rv2-vazio">${s.atras.length?'Nada novo para hoje. Faça o que ficou para trás, de cima para baixo.':'Nada para revisar hoje. Pode ir direto para a aula nova.'}</p>`}
    ${s.atras.length?`<h4 class="rv2-sub">Ficou para trás <span class="muted small">(os de cima caem mais na prova; faça esses primeiro)</span></h4>${atrasVis.map(p=>item(p,e)).join('')}
      ${s.atras.length>5?`<button class="btn sec rv2-mais" data-acao="todas">${verTodas?'Mostrar só 5':'Mostrar todas ('+s.atras.length+')'}</button>`:''}`:''}
  </div>
  <div class="grade2">
    <div class="painel"><div class="painel-cab"><h3>${I('calendar-days')}Próximos 7 dias</h3></div>
      <ul class="rv2-prox">${prox.map(([d,l])=>`<li><b>${fmtData(d)}</b><span>${l.map(x=>esc(U(x.u).as)).join(' · ')}</span></li>`).join('')||'<li class="muted small">Nada marcado.</li>'}</ul></div>
    <div class="painel"><div class="painel-cab"><h3>${I('target')}Como você está indo</h3><span class="muted small">últimas 4 semanas</span></div>
      <p class="small">${feitas.length?`<b>${feitas.length}</b> revisões feitas · <b>${tot[1]?Math.round(tot[0]/tot[1]*100):0}%</b> de acerto (${tot[0]} de ${tot[1]})`:'Nenhuma revisão feita ainda por aqui.'}</p>
      ${fracos.length?`<p class="small" style="margin-top:6px">Abaixo de 60% na última vez: ${fracos.map(f=>`${esc(f[0])} (${f[1]}%)`).join(' · ')}</p>`:''}
      <div class="rv2-anki"><p class="small"><b>${pend.length}</b> erro${pend.length===1?'':'s'} esperando virar card de Anki.</p>
      ${pend.length?`<div class="acoes"><button class="btn sec" data-acao="copiar">${I('clipboard-check')}Copiar erros para o chat</button><button class="btn sec" data-acao="enviados">${I('check')}Já mandei</button></div><p class="muted small">Cole no chat do projeto e peça "faz os cards dos erros". Ou só diga isso: eu leio a lista daqui.</p>`:''}</div>
    </div>
  </div>`;
  ligar(box,s);
}
function textoErros(e){
  const l=e.er.filter(x=>!x[4]);
  return 'Erros da revisão para virar card de Anki:\n'+l.map(x=>`- ${curta(x[0])} · ${U(x[1]).mat} · ${U(x[1]).as}: ${x[2]}${x[3]?' → certo: '+x[3]:''}`).join('\n');
}
function ligar(box,s){
  box.querySelectorAll('.rv2-top').forEach(b=>b.onclick=()=>{const u=b.closest('.rv2-item').dataset.u;aberto=aberto===u?null:u;painel();});
  box.querySelectorAll('[data-acao]').forEach(b=>b.onclick=async()=>{
    const a=b.dataset.acao; const it=b.closest('.rv2-item'); const p=it&&s.lista.find(x=>x.u===it.dataset.u);
    if(a==='todas'){verTodas=!verTodas;return painel();}
    if(a==='copiar'){const t=textoErros(est());try{await navigator.clipboard.writeText(t);toast('Copiado. Cole no chat','clipboard-check');}catch(_){window.prompt('Copie o texto:',t);}return;}
    if(a==='enviados'){const e=est();e.er.forEach(x=>{x[4]=1;});salvar(e);toast('Marcado como enviado','check');return painel();}
    if(!p) return;
    if(a==='tec'){const v=(it.querySelector('[data-tec]').value||'').trim();if(v&&!/^https:\/\/(www\.)?tecconcursos\.com\.br\//.test(v)){toast('Cole um link do tecconcursos.com.br','circle-x');return;}const e=est();if(v)e.tec[p.u]=v;else delete e.tec[p.u];salvar(e);toast('Link guardado','check');return painel();}
    if(a==='erro'){const er=(it.querySelector('[data-er]').value||'').replace(/\s+/g,' ').trim();const ct=(it.querySelector('[data-ct]').value||'').replace(/\s+/g,' ').trim();
      if(er.length<3){toast('Escreva o erro em uma linha','zap');return;}
      const e=est();e.er.push([HOJE,p.u,er,ct,0]);salvar(e);toast('Erro anotado','check');return painel();}
    if(a==='concluir'){const ac=parseInt(it.querySelector('[data-a]').value,10);const tt=parseInt(it.querySelector('[data-t]').value,10);
      if(!(tt>0)||!(ac>=0)||ac>tt){toast('Preencha acertos e feitas (acertos até o total)','zap');return;}
      const m=concluir(p,ac,tt);aberto=null;toast(m,ac/tt<0.6?'rotate-ccw':'circle-check-big');atualizarInicio();return painel();}
    if(a==='adiar'){adiar(p);aberto=null;atualizarInicio();return painel();}
    if(a==='dispensar'){dispensar(p);aberto=null;atualizarInicio();return painel();}
  });
}

/* ---------- Início: a linha "Revisões" passa a mostrar a revisão nova; a linha de cards sai ---------- */
function atualizarInicio(){
  const s=resumoHoje(); if(!s) return;
  HOJE_REV.revisoes=s.lista.length; HOJE_REV.questoes=s.lista.length*12;
  HOJE_REV.lista=s.lista.map(x=>U(x.u).as);
  try{ if(typeof abaVisivel==='function'&&abaVisivel()==='inicio') renderHoje(); }catch(_){}
}
function limparInicio(){
  const box=document.getElementById('hoje'); if(!box) return;
  box.querySelectorAll('li').forEach(li=>{const b=li.querySelector('b');if(!b)return;const t=b.textContent;
    if(t.includes('Cards · FSRS')) li.style.display='none';
    if(t.includes('Revisões · questões')){b.textContent='Revisão do dia';const sp=li.querySelector('.muted.small');if(sp&&!HOJE_REV.revisoes)sp.textContent='Nada para revisar hoje.';}
  });
}
if(typeof renderHoje==='function'){const h0=renderHoje;window.renderHoje=function(){const r=h0.apply(this,arguments);try{limparInicio();}catch(_){}return r;};}

/* ---------- aba Revisão: o bloco novo entra no lugar da R1/R7; cards do Mentor saem da tela ---------- */
const api0=window.__api; let pularVelha=false;
window.__api=function(path,body,tentou){
  if(pularVelha&&path==='/mentor/revisoes/hoje') return Promise.resolve({revisoes:[],materias:[],teto_minutos:0});
  return api0(path,body,tentou);
};
const rev0=window.renderRevisao;
window.renderRevisao=async function(){
  const box=document.getElementById('rev-painel');
  let v2=document.getElementById('rev2');
  if(!v2){v2=document.createElement('div');v2.id='rev2';box.parentNode.insertBefore(v2,box);}
  painel();
  pularVelha=true; let pr; try{pr=rev0();}finally{pularVelha=false;}
  await pr;
  box.querySelectorAll('h3').forEach(h=>{
    if(h.textContent.includes('Cards · FSRS')){const p=h.closest('.painel');if(p)p.style.display='none';}
    if(h.textContent.includes('3. Caderno de erros')){h.lastChild.textContent='2. Caderno de erros do Mentor';}
  });
  const g=box.querySelector('.grade2:not([style*="margin-top:0"])'); if(g) g.style.gridTemplateColumns='1fr';
  atualizarInicio();
};

const css=document.createElement('style');
css.textContent=`
#rev-painel>.cab,#rev-painel>#rev-mats,#rev-painel>.grade2[style*="margin-top:0"],#rev-painel>#rev-card{display:none}
.rv2-item{border:1px solid var(--border);border-radius:12px;margin:8px 0;background:var(--card2,var(--card))}
.rv2-item.aberto{border-color:var(--acc)}
.rv2-top{all:unset;box-sizing:border-box;width:100%;display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer}
.rv2-top:focus-visible{outline:2px solid var(--acc);border-radius:12px}
.rv2-nome{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.rv2-nome b{font-size:15px}
.rv2-f{font-size:10.5px;font-weight:800;border-radius:999px;padding:3px 8px;white-space:nowrap}
.rv2-f.f1{background:rgba(239,68,68,.15);color:var(--red400)}
.rv2-f.f2{background:rgba(245,158,11,.15);color:var(--amber400)}
.rv2-f.f3{background:rgba(148,163,184,.15);color:var(--muted)}
.rv2-seta .ic{width:16px;height:16px;transition:transform .15s}
.rv2-item.aberto .rv2-seta .ic{transform:rotate(180deg)}
.rv2-corpo{padding:0 14px 14px}
.rv2-passos{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:14px}
.rv2-passos li{line-height:1.5}
.rv2-dica{display:block;margin-top:6px}
.rv2-linha,.rv2-erro{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}
.rv2-erro .rv2-in{flex:1 1 260px}
.rv2-in{padding:9px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--fg);font:inherit;font-size:14px;min-width:0}
.rv2-num{width:90px}
.rv2-link{margin-top:8px}.rv2-link .rv2-in{flex:1 1 260px}
.rv2-erros{margin:8px 0 0;padding-left:18px;font-size:13px}
.rv2-acoes{margin-top:14px}
.rv2-sub{margin:18px 0 4px;font-size:14px}
.rv2-vazio{margin:4px 0 8px}
.rv2-mais{margin-top:6px}
.rv2-prox{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;font-size:13px}
.rv2-prox li{display:grid;grid-template-columns:90px 1fr;gap:8px}
.rv2-anki{margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}
@media (max-width:560px){.rv2-top{flex-wrap:wrap}.rv2-prox li{grid-template-columns:1fr}}
`;
document.head.appendChild(css);

/* ---------- carga ---------- */
fetch('/mentor/revisao_v2.json?v='+(window.__REV2_V||'1'),{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(j=>{
  if(!j||!Array.isArray(j.agenda)){console.warn('revisao_v2.json não carregou');return;}
  R=j; carregou=true; iniciar(); atualizarInicio();
  try{limparInicio();}catch(_){}
  if(document.getElementById('rev2')) painel();
}).catch(()=>{});
window.__rev2={resumo:resumoHoje,erros:()=>est().er,texto:()=>textoErros(est())};
})();
