/* Mike Mentor · Questões e Cards (v5, 14/11/2026)
   Duas abas novas dentro da Missão:
   - Questões: as provas da PMBA (Soldado e CFO), com gabarito oficial e comentário. Filtro pelo objetivo
     (Soldado, CFO ou os dois), por matéria e assunto; "Revisar erros" (o que você errou volta em 2, 7 e 21 dias);
     simulado com a prova inteira. As questões entram no dia: revisão, trilha, ficha e domingo puxam daqui.
   - Cards: os itens Certo/Errado das fichas, o dicionário de termos das provas e os seus cards, com repetição
     espaçada (FSRS, o mesmo algoritmo do Anki novo). O aquecimento do dia passa a ser aqui.
   O texto das provas fica cifrado (banco.bin); a chave vem do estado do Santos (mm3_qk), não fica no site.
   Estado: mm3_q (questões) e mm3_cards (cards), pelo mesmo caminho da Missão (banco + cópia no aparelho). */
(function(){
'use strict';
if(window.__estudo) return;
const VERSAO='20261114q';
const KQ='mm3_q', KC='mm3_cards', KK='mm3_qk';
const W=[0.4872,1.4003,3.7145,13.8206,5.1618,1.2298,0.8975,0.031,1.6474,0.1367,1.0461,2.1072,0.0793,0.3246,1.587,0.2272,2.8755];
const DECAY=-0.5, FACTOR=19/81, RET=0.9;
const DIA0=Date.UTC(2026,0,1);

let X=null;            /* helpers da Missão (window.__mx) */
let EJ=null;           /* estudo.json: tópicos, baralhos, cards */
let BQ=null;           /* banco de questões decifrado */
let bancoErro='';      /* motivo de não ter banco */
let TOPK={}, QID={}, DECK={}, CARD={};
let ses=null;          /* sessão aberta (questões ou cards) */
let ov=null;           /* overlay da sessão */
let filtro={mat:'',t:'',so:'novas',n:10};
const figURL={};

/* ================================================================ utilidades */
const H=()=>X.HOJE;
const esc=s=>X.esc(s);
const I=(n,c)=>X.I(n,c);
const diaNum=s=>Math.round((Date.UTC(+s.slice(0,4),+s.slice(5,7)-1,+s.slice(8,10))-DIA0)/864e5);
const numDia=n=>{const d=new Date(DIA0+n*864e5);return d.toISOString().slice(0,10);};
const hojeN=()=>diaNum(H());
const subl=s=>s.replace(/&lt;(\/?)u&gt;/g,'<$1u>');   /* trecho sublinhado da prova: <u>…</u> */
const semTag=s=>(s||'').replace(/<\/?u>/g,'');
const nl2br=s=>subl(esc(s)).replace(/\n/g,'<br>');
const negrito=s=>subl(esc(s)).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');
const embaralhar=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const alvoTxt=a=>a==='SDCFO'?'SD · CFO':a;
const alvoChip=a=>`<span class="es-alvo ${a==='SDCFO'?'ambos':a==='CFO'?'cfo':'sd'}" title="${a==='SDCFO'?'Cai no Soldado e no CFO':a==='CFO'?'Só o CFO cobra':'Cai no Soldado'}">${alvoTxt(a)}</span>`;
const pctN=(a,t)=>t?Math.round(a/t*100):0;
const tempo=seg=>seg<60?Math.max(1,Math.round(seg))+' s':X.fmtM(seg/60);

/* ================================================================ estado */
function Q(){const q=Object.assign({},X.lerK(KQ)||{});q.r=q.r||{};q.qd=q.qd||{};q.res=q.res||{};q.sim=q.sim||{};q.cfg=q.cfg||{};q.hist=q.hist||{};return q;}
function salvarQ(q){X.gravarK(KQ,q);}
function C(){const c=Object.assign({},X.lerK(KC)||{});c.c=c.c||{};c.dia=c.dia||{};c.meus=c.meus||[];c.off=c.off||{};if(c.novos==null)c.novos=15;return c;}
function salvarC(c){X.gravarK(KC,c);}
function alvoAtual(q){return (q||Q()).cfg.alvo||(H()<'2027-02-01'?'SD':'AMBOS');}

/* ================================================================ chave e banco cifrado */
function b64u(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const b=atob(s);const u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
function chaveGuardada(){const k=X.lerK(KK);if(typeof k==='string'&&k.length>30)return k;if(k&&k.k)return k.k;try{return localStorage.getItem('mx_qk')||'';}catch(_){return '';}}
function guardarChave(k){try{localStorage.setItem('mx_qk',k);}catch(_){} X.gravarK(KK,{k});}
let CK=null;
async function chaveCripto(){if(CK)return CK;const k=chaveGuardada();if(!k)return null;CK=await crypto.subtle.importKey('raw',b64u(k),'AES-GCM',false,['decrypt']);return CK;}
async function decifrar(buf){const k=await chaveCripto();if(!k)throw new Error('sem chave');const u=new Uint8Array(buf);return crypto.subtle.decrypt({name:'AES-GCM',iv:u.slice(0,12)},k,u.slice(12));}
async function gunzip(buf){
  if(typeof DecompressionStream==='undefined') throw new Error('Este navegador é antigo para abrir o banco. Atualize o Chrome ou o iPhone.');
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
async function carregarBanco(){
  if(BQ||!EJ||!EJ.banco) return;
  if(!chaveGuardada()){bancoErro='chave';return;}
  try{
    const r=await fetch('/mentor/banco.bin?v='+EJ.banco.v,{cache:'force-cache'}); if(!r.ok) throw new Error('HTTP '+r.status);
    const txt=await gunzip(await decifrar(await r.arrayBuffer()));
    BQ=JSON.parse(txt); BQ.q.forEach(q=>{QID[q.id]=q;}); BQ.pv={}; BQ.provas.forEach(p=>{BQ.pv[p.id]=p;});
    bancoErro='';
  }catch(e){bancoErro=e.message==='sem chave'?'chave':(e.name==='OperationError'?'chave-errada':e.message);console.warn('banco',e);}
}
async function figura(path){
  if(figURL[path]) return figURL[path];
  const nome=path.split('/').pop().replace(/\.png$/,'');
  const r=await fetch('/mentor/fig/'+nome+'.bin?v='+EJ.banco.v,{cache:'force-cache'}); if(!r.ok) throw new Error('fig');
  const b=await decifrar(await r.arrayBuffer());
  return (figURL[path]=URL.createObjectURL(new Blob([b],{type:'image/png'})));
}
function ampliar(src){
  const z=document.createElement('div');z.className='es-zoom';z.setAttribute('role','dialog');z.setAttribute('aria-label','Figura ampliada');
  z.innerHTML=`<img src="${src}" alt="Figura ampliada"><button class="es-zoom-x" aria-label="Fechar">${X.I('x')}</button><div class="es-zoom-dica">Arraste para ver tudo · toque para fechar</div>`;
  const fechar=()=>{z.remove();document.removeEventListener('keydown',esc,true);};
  const esc=e=>{if(e.key==='Escape'){e.stopPropagation();e.preventDefault();fechar();}};
  let mov=0;z.addEventListener('pointerdown',()=>{mov=0;});z.addEventListener('pointermove',()=>{mov++;});
  z.addEventListener('click',()=>{if(mov<4)fechar();});document.addEventListener('keydown',esc,true);
  document.body.appendChild(z);
}
function pintarFiguras(){
  if(!ov) return;
  ov.querySelectorAll('img[data-fig]').forEach(img=>{if(img.dataset.ok)return;img.dataset.ok=1;
    figura(img.dataset.fig).then(u=>{img.src=u;}).catch(()=>{img.alt='(figura não carregou)';img.classList.add('falhou');});});
}

/* ================================================================ questões: escolha */
const valida=q=>q.g&&q.g!=='ANULADA'&&q.a&&q.a.length>=2;
function topico(k){return TOPK[k]||{as:k,mat:'',alvo:'SD'};}
function noAlvo(q,alvo){if(alvo==='AMBOS')return true;const t=topico(q.t);return (t.alvo||'SD').includes(alvo);}
function situacao(q,st){const r=st.r[q.id];const d=st.qd[q.id];
  if(d&&d<=H()) return 'erro-hoje'; if(!r) return 'nova'; if(r[2]===0) return 'errada'; return 'feita';}
/* ordem: erro vencido > inédita (prova de SD mais recente primeiro) > errada > feita há mais tempo */
function ordenar(l,st){
  const peso=q=>{const s=situacao(q,st);const p=BQ.pv[q.p]||{};const ano=p.ano||2000;
    return (s==='erro-hoje'?0:s==='nova'?1:s==='errada'?2:3)*1e6+(p.conc==='SD'?0:1e5)+(2100-ano)*100+(q.n/1000);};
  return l.slice().sort((a,b)=>peso(a)-peso(b));
}
/* questões que usam o mesmo texto ficam juntas, na ordem da prova */
function agruparTextos(l){
  const out=[];const vis=new Set();
  l.forEach(q=>{if(vis.has(q.id))return;
    if(q.tx){l.filter(x=>x.tx===q.tx&&!vis.has(x.id)).sort((a,b)=>a.n-b.n).forEach(x=>{vis.add(x.id);out.push(x);});}
    else {vis.add(q.id);out.push(q);}});
  return out;
}
function deTopicos(ks){const set=new Set(ks);return BQ.q.filter(q=>valida(q)&&set.has(q.t));}
function topicosDaUnidade(u){return EJ.topicos.filter(t=>t.u===u).map(t=>t.k);}
function contar(spec){if(!BQ)return 0;return candidatos(spec).length;}
function candidatos(spec){
  const st=Q(); let l;
  if(spec.ids) l=spec.ids.map(id=>QID[id]).filter(Boolean);
  else if(spec.prova) l=BQ.q.filter(q=>q.p===spec.prova&&valida(q)).sort((a,b)=>a.n-b.n);
  else {
    let ks=[];
    if(spec.u) ks=topicosDaUnidade(spec.u);
    if(spec.us) spec.us.forEach(u=>{ks=ks.concat(topicosDaUnidade(u));});
    if(spec.t) ks.push(spec.t);
    if(spec.ts) ks=ks.concat(spec.ts);
    if(spec.mat) ks=ks.concat(EJ.topicos.filter(t=>t.mat===spec.mat).map(t=>t.k));
    l=ks.length?deTopicos(ks):BQ.q.filter(valida);
    const alvo=spec.alvo||(spec.u||spec.us||spec.t||spec.ts?'AMBOS':alvoAtual(st));
    l=l.filter(q=>noAlvo(q,alvo));
    if(spec.so==='erros') l=l.filter(q=>{const s=situacao(q,st);return s==='erro-hoje'||s==='errada';});
    else if(spec.so==='vencidas') l=l.filter(q=>situacao(q,st)==='erro-hoje');
    else if(spec.so==='novas') {const n=l.filter(q=>situacao(q,st)!=='feita');if(n.length)l=n;}
  }
  return l;
}
function montarLista(spec){
  const st=Q(); let l=candidatos(spec);
  if(spec.prova||spec.ids) return l.map(q=>q.id);
  if(spec.mix){ /* uma de cada assunto, em rodízio */
    const por={};ordenar(l,st).forEach(q=>{(por[q.t]=por[q.t]||[]).push(q);});
    const filas=embaralhar(Object.values(por));const out=[];
    while(out.length<spec.n&&filas.some(f=>f.length)) filas.forEach(f=>{if(f.length&&out.length<spec.n)out.push(f.shift());});
    return agruparTextos(out).map(q=>q.id);
  }
  l=ordenar(l,st);
  /* não corta no meio de um bloco de texto */
  const esc2=[];for(const q of l){if(esc2.length>=spec.n&&!(q.tx&&esc2.length&&esc2[esc2.length-1].tx===q.tx))break;esc2.push(q);}
  return agruparTextos(esc2).map(q=>q.id);
}

/* ================================================================ questões: sessão */
function abrirQuiz(spec){
  if(!BQ){X.aviso(bancoErro==='chave'?'Falta ativar o banco de questões (aba Questões)':'O banco de questões ainda está carregando','zap');return;}
  const ids=montarLista(spec);
  if(!ids.length){X.aviso('Sem questões da PMBA para esse filtro','zap');return;}
  ses={tipo:'q',spec,ids,i:0,resp:{},ini:Date.now(),t0:Date.now(),prova:!!spec.prova,risca:{},sel:null,texto:{} };
  guardarSes(); desenharSes();
}
function guardarSes(){try{sessionStorage.setItem('es_ses',JSON.stringify(ses));}catch(_){}}
function questaoAtual(){return ses&&QID[ses.ids[ses.i]];}
function responder(){
  const q=questaoAtual(); if(!q||!ses.sel) return;
  const seg=Math.round((Date.now()-ses.t0)/1000); const ok=ses.sel===q.g?1:0;
  ses.resp[q.id]={m:ses.sel,ok,s:seg};
  if(!ses.prova) registrar([[q,ses.sel,ok]]);
  guardarSes();
  if(ses.prova){proxima();return;}
  desenharSes();
  const fb=ov&&ov.querySelector('.es-fb'); if(fb) setTimeout(()=>fb.scrollIntoView({behavior:'smooth',block:'nearest'}),60);
}
/* histórico: errou volta em 2 dias; acertou a que estava errada: 7 e depois 21; acertou de novo: sai da fila */
function registrar(l){
  const st=Q(); const hj=H();
  l.forEach(([q,m,ok])=>{const r=st.r[q.id]||[null,null,null,0,0];
    const passo=st.qd[q.id]?(st.r[q.id]&&st.r[q.id][5])||0:0;
    st.r[q.id]=[hj,m,ok,(r[3]||0)+1,(r[4]||0)+ok,ok?passo+1:0];
    if(!ok) st.qd[q.id]=X.add(hj,2);
    else if(st.qd[q.id]){ if(passo>=2) delete st.qd[q.id]; else st.qd[q.id]=X.add(hj,passo===0?7:21); }
    const h=st.hist[hj]=st.hist[hj]||[0,0]; h[0]++; h[1]+=ok;});
  const dias=Object.keys(st.hist).sort(); dias.slice(0,-120).forEach(d=>delete st.hist[d]);
  salvarQ(st);
}
function proxima(){
  if(!ses) return;
  if(ses.i<ses.ids.length-1){ses.i++;ses.sel=null;ses.t0=Date.now();guardarSes();desenharSes();ov.querySelector('.es-corpo').scrollTo(0,0);return;}
  if(ses.prova&&!ses.entregue){const falta=ses.ids.filter(id=>!ses.resp[id]).length; if(falta){ses.grade=1;desenharSes();return;}}
  fimQuiz();
}
function fimQuiz(){
  if(ses.prova&&!ses.entregue){ses.entregue=1;const l=ses.ids.map(id=>QID[id]).filter(q=>ses.resp[q.id]).map(q=>[q,ses.resp[q.id].m,ses.resp[q.id].ok]);registrar(l);
    const a=l.filter(x=>x[2]).length; const st=Q(); st.sim[ses.spec.prova]=[H(),a,ses.ids.length,Math.round((Date.now()-ses.ini)/1000)]; salvarQ(st);}
  const tot=ses.ids.filter(id=>ses.resp[id]).length, ac=ses.ids.filter(id=>ses.resp[id]&&ses.resp[id].ok).length;
  if(ses.spec.orig&&tot){const st=Q();st.res[ses.spec.orig]=[H(),ac,tot];salvarQ(st);}
  ses.fim=1; guardarSes(); desenharSes();
}
function fecharSes(){ses=null;try{sessionStorage.removeItem('es_ses');}catch(_){} if(ov){ov.remove();ov=null;} document.body.classList.remove('es-aberto'); X.render();}

/* ================================================================ cards: FSRS */
const D0=g=>Math.min(10,Math.max(1,W[4]-(g-3)*W[5]));
const Rt=(t,s)=>Math.pow(1+FACTOR*t/s,DECAY);
function maxIvl(){const p=(X.MJ&&X.MJ.prova&&X.MJ.prova.Soldado)||'2027-04-04';return Math.max(2,Math.min(120,X.entre(H(),p)-2));}
function proximo(st,g){
  /* st: [S, D, due, last, reps, lapses] ou null (novo); devolve o novo estado */
  const hj=hojeN(); let S,D;
  if(!st){S=W[g-1];D=D0(g);}
  else{const t=Math.max(0,hj-st[3]);const r=Rt(t,st[0]);D=st[1];
    if(g===1) S=Math.min(st[0],W[11]*Math.pow(D,-W[12])*(Math.pow(st[0]+1,W[13])-1)*Math.exp(W[14]*(1-r)));
    else S=st[0]*(1+Math.exp(W[8])*(11-D)*Math.pow(st[0],-W[9])*(Math.exp(W[10]*(1-r))-1)*(g===2?W[15]:1)*(g===4?W[16]:1));
    D=Math.min(10,Math.max(1,W[7]*D0(4)+(1-W[7])*(D-W[6]*(g-3))));}
  S=Math.max(0.1,S);
  let ivl=g===1?1:Math.max(1,Math.round(S/FACTOR*(Math.pow(RET,1/DECAY)-1)));
  if(ivl>2) ivl=Math.max(2,Math.round(ivl*(0.95+Math.random()*0.1)));
  ivl=Math.min(ivl,maxIvl());
  return [Math.round(S*100)/100,Math.round(D*100)/100,hj+ivl,hj,(st?st[4]:0)+1,(st?st[5]:0)+(g===1&&st?1:0)];
}
function ivlTxt(st,g){const n=proximo(st,g)[2]-hojeN();return n<=1?(g===1?'amanhã':'1 dia'):n<30?n+' dias':Math.round(n/30)+' meses';}
function todosCards(c){
  const l=EJ.cards.filter(x=>!c.off[x.b]);
  c.meus.forEach(m=>l.push({id:m.id,b:'meus',k:'flip',f:m.f,v:m.v,p:m.p||'',meu:1}));
  return l;
}
/* fila do dia: revisões vencidas (as mais atrasadas primeiro) + novos até o limite, 2 de conteúdo para 1 do dicionário */
function filaCards(c){
  c=c||C(); const hj=hojeN(); const hoje=c.dia[H()]||[0,0,0,0];
  const l=todosCards(c);
  const rev=l.filter(x=>c.c[x.id]&&c.c[x.id][2]<=hj).sort((a,b)=>c.c[a.id][2]-c.c[b.id][2]);
  const prio=x=>{const d=DECK[x.b]||{f:2,pp:0};return (d.f||3)*100-(d.pp||0);};
  const nov=l.filter(x=>!c.c[x.id]);
  const conteudo=nov.filter(x=>x.k!=='termo').sort((a,b)=>(a.meu?-1:0)-(b.meu?-1:0)||prio(a)-prio(b));
  const dic=nov.filter(x=>x.k==='termo').sort((a,b)=>(b.na||0)-(a.na||0));
  const restam=Math.max(0,c.novos-hoje[1]); const novos=[];
  while(novos.length<restam&&(conteudo.length||dic.length)){
    for(let i=0;i<2&&conteudo.length&&novos.length<restam;i++) novos.push(conteudo.shift());
    if(dic.length&&novos.length<restam) novos.push(dic.shift());
  }
  return {rev,novos,todos:l.length,feitosHoje:hoje[0],minutos:Math.max(rev.length||novos.length?3:0,Math.round((rev.length*10+novos.length*20)/60))};
}
function abrirCards(spec){
  const c=C(); if(!c.m) c.m='mentor';
  let fila;
  if(spec&&spec.deck){const l=todosCards(c).filter(x=>x.b===spec.deck);const hj=hojeN();fila=l.filter(x=>!c.c[x.id]||c.c[x.id][2]<=hj).map(x=>x.id);if(!fila.length)fila=embaralhar(l.map(x=>x.id)).slice(0,20);}
  else{const f=filaCards(c);const ids=f.rev.map(x=>x.id);
    /* novos espalhados no meio das revisões */
    f.novos.forEach((x,i)=>{const pos=Math.min(ids.length,Math.round((i+1)*(ids.length/(f.novos.length+1))));ids.splice(pos+i,0,x.id);});
    fila=ids;}
  if(!fila.length){X.aviso('Nenhum card para hoje. Amanhã tem mais','circle-check-big');return;}
  ses={tipo:'c',spec:spec||{},fila,i:0,feitos:[],erros:0,ini:Date.now(),virado:false,resp:null,refazer:{}};
  guardarSes(); desenharSes();
}
function cardAtual(){if(!ses)return null;const id=ses.fila[ses.i];return CARD[id]||(()=>{const m=C().meus.find(x=>x.id===id);return m?{id:m.id,b:'meus',k:'flip',f:m.f,v:m.v,p:m.p||'',meu:1}:null;})();}
function avaliar(g){
  const card=cardAtual(); if(!card) return;
  const c=C(); const antes=c.c[card.id]||null; const refaz=ses.refazer[card.id];
  if(!refaz){c.c[card.id]=proximo(antes,g);
    const d=c.dia[H()]=c.dia[H()]||[0,0,0,0]; d[0]++; if(!antes)d[1]++; if(g===1)d[2]++; d[3]+=Math.round((Date.now()-(ses.tc||ses.ini))/1000);
    const dias=Object.keys(c.dia).sort(); dias.slice(0,-120).forEach(k=>delete c.dia[k]);
    salvarC(c);}
  ses.ultimo={id:card.id,antes,refaz,i:ses.i};
  ses.feitos.push([card.id,g]); if(g===1){ses.erros++; ses.refazer[card.id]=1; ses.fila.splice(Math.min(ses.fila.length,ses.i+5),0,card.id);}
  ses.i++; ses.virado=false; ses.resp=null; ses.tc=Date.now();
  if(ses.i>=ses.fila.length){ses.fim=1; const f=filaCards(); if(!f.rev.length&&!f.novos.length&&!ses.spec.deck) X.marcar&&X.marcar('anki');}
  guardarSes(); desenharSes();
}
function desfazerCard(){
  if(!ses||!ses.ultimo) return; const u=ses.ultimo; const c=C();
  if(!u.refaz){ if(u.antes) c.c[u.id]=u.antes; else delete c.c[u.id];
    const d=c.dia[H()]; if(d){d[0]=Math.max(0,d[0]-1); if(!u.antes)d[1]=Math.max(0,d[1]-1);} salvarC(c);}
  const ult=ses.feitos.pop(); if(ult&&ult[1]===1){ses.erros--; const j=ses.fila.lastIndexOf(u.id); if(j>u.i) ses.fila.splice(j,1); delete ses.refazer[u.id];}
  ses.i=u.i; ses.virado=false; ses.resp=null; ses.fim=0; ses.ultimo=null; guardarSes(); desenharSes();
}
/* "trazer do Anki": o que ele já estuda lá entra como visto, com a 1ª revisão espalhada em 14 dias */
function importarAnki(){
  const c=C(); const hj=hojeN(); const l=EJ.cards.filter(x=>x.k!=='termo'&&!c.c[x.id]);
  l.forEach((x,i)=>{const due=hj+1+Math.floor(i/Math.max(1,l.length/14));const S=4+Math.random()*6;c.c[x.id]=[Math.round(S*100)/100,5,due,due-Math.round(S),1,0];});
  c.m='mentor'; salvarC(c); return l.length;
}

/* ================================================================ integração com a Missão */
function modoCards(){const c=X.lerK(KC);return c&&c.m||null;}
function resumoCards(){if(!EJ)return null;const f=filaCards();return {rev:f.rev.length,novos:f.novos.length,min:f.minutos,feitos:f.feitosHoje};}
function etapaCards(et,ok){
  const f=filaCards(); const n=f.rev.length+f.novos.length;
  return `<p class="mx-porque">${I('brain')}Puxar da memória logo no começo acorda a cabeça e fixa o que você viu nos últimos dias. Errou? O card volta na mesma sessão e amanhã.</p>
    <div class="es-cnum"><div><b>${f.rev.length}</b><i>revisões</i></div><div><b>${f.novos.length}</b><i>novos</i></div><div><b>${f.minutos}</b><i>min</i></div></div>
    ${n?`<div class="mx-acoes"><button class="mx-btn" data-acao="c-estudar">${I('play')}Estudar os cards</button></div>`:`<div class="mx-ok">${I('circle-check-big')}<span>${f.feitosHoje?`${f.feitosHoje} cards hoje. Nada mais vencido.`:'Nenhum card vencido hoje.'}</span></div>`}
    ${ok||n?'':''}<div class="mx-acoes">${ok?`<button class="mx-btn sec" data-acao="desmarcar" data-id="anki">${I('undo')}Desfazer</button>`:(!n?`<button class="mx-btn sec" data-acao="marcar" data-id="anki">${I('check')}Fechar a etapa</button>`:'')}</div>`;
}
/* botão "fazer N questões da PMBA" usado nas etapas do dia */
function botaoQuiz(spec,rot){
  if(!EJ||!EJ.banco) return '';
  if(!BQ) return bancoErro==='chave'?`<p class="mx-dica">${I('lock')}Ative o banco de questões na aba Questões para fazer aqui as questões da PMBA.</p>`:'';
  const n=candidatos(spec).length; if(!n) return '';
  const st=Q(); const r=spec.orig&&st.res[spec.orig]; const feitoHoje=r&&r[0]===H();
  const qtd=Math.min(spec.n||10,n);
  return `<div class="es-qbt"><button class="mx-btn ${spec.sec?'sec':''}" data-acao="q-abrir" data-spec="${esc(JSON.stringify(spec))}">${I('circle-help')}${rot||`Fazer ${qtd} ${qtd===1?'questão':'questões'} da PMBA`}</button>
    <span class="mx-dica">${n} ${n===1?'questão':'questões'} de provas da PMBA nesse assunto${feitoHoje?` · hoje: ${r[1]} de ${r[2]} (${pctN(r[1],r[2])}%)`:''}</span></div>`;
}
function resultado(orig){const st=X.lerK(KQ);const r=st&&st.res&&st.res[orig];return r&&r[0]===H()?{a:r[1],t:r[2]}:null;}
function alvoDaUnidade(u){const t=EJ&&EJ.topicos.find(x=>x.u===u);return t?t.alvo:null;}

/* ================================================================ desenho: sessão (tela cheia) */
function desenharSes(){
  if(!ses){if(ov){ov.remove();ov=null;}return;}
  if(!ov){ov=document.createElement('div');ov.id='es-sessao';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');document.body.appendChild(ov);
    ov.addEventListener('click',clique);document.body.classList.add('es-aberto');}
  ov.innerHTML=ses.tipo==='q'?htmlQuiz():htmlCards();
  pintarFiguras();
}
function barraTopo(pos,tot,dir){
  return `<header class="es-topo"><button class="es-x" data-acao="s-sair" aria-label="Sair">${I('x')}</button>
    <div class="es-prog">${X.barra(tot?pos/tot:0,'em')}</div><span class="es-cont">${pos} / ${tot}</span>${dir||''}</header>`;
}
function textoHtml(t,aberto,tid){
  if(!t) return '';
  const corpo=t.ln?`<div class="es-tx-c ln">${t.c.split('\n').map(l=>`<span>${subl(esc(l))}</span>`).join('')}</div>`:`<div class="es-tx-c">${t.c.split(/\n{2,}/).map(p=>`<p>${nl2br(p)}</p>`).join('')}</div>`;
  return `<details class="es-texto" data-tx="${esc(tid||'')}" ${aberto?'open':''}><summary>${I('file-text')}<b>${esc(t.ti||'Texto da questão')}</b><i>toque para ${aberto?'fechar':'ler'}</i></summary>${corpo}${t.fo?`<p class="es-tx-f">${esc(t.fo)}</p>`:''}</details>`;
}
function metaQ(q){
  const p=BQ.pv[q.p]||{}; const t=topico(q.t);
  return `<div class="es-meta"><span class="es-prova ${p.conc==='CFO'?'cfo':''}">${p.conc==='CFO'?'CFO':'Soldado'} ${esc(p.ano)} · ${esc(p.banca)} · Q${q.n}</span><span class="mx-chip">${esc(t.as)}</span>${alvoChip(t.alvo||'SD')}</div>`;
}
function htmlQuiz(){
  if(ses.fim) return htmlFimQuiz();
  if(ses.grade) return htmlGrade();
  const q=questaoAtual(); const r=ses.resp[q.id]; const mostra=r&&!ses.prova; const tx=q.tx&&BQ.textos[q.tx];
  if(tx&&ses.texto[q.tx]==null) ses.texto[q.tx]=q.id; /* aberto na primeira questão do texto */
  const txAberto=tx&&(ses.txOpen&&ses.txOpen[q.tx]!=null?ses.txOpen[q.tx]:ses.texto[q.tx]===q.id);
  const risc=ses.risca[q.id]||{};
  const relogio=ses.prova?`<span class="es-tempo" data-es-tempo>${X.mmss(Date.now()-ses.ini)}</span><button class="es-x" data-acao="q-grade" aria-label="Ver todas">${I('layers')}</button>`:'';
  const alts=q.a.map(([l,t])=>{
    const cls=[mostra&&l===q.g?'certa':'',mostra&&r.m===l&&!r.ok?'errada':'',!mostra&&(ses.sel===l||(ses.prova&&r&&r.m===l))?'sel':'',risc[l]?'riscada':''].join(' ');
    return `<li class="es-alt ${cls}"><button class="es-alt-b" data-acao="q-alt" data-l="${l}" ${mostra?'disabled':''} aria-pressed="${ses.sel===l}"><span class="es-l">${l}</span><span class="es-at">${nl2br(t)}</span></button>${mostra?'':`<button class="es-risca" data-acao="q-risca" data-l="${l}" aria-label="Riscar a alternativa ${l}" title="Riscar">${I('x')}</button>`}</li>`;}).join('');
  const fig=(q.fig||[]).map(f=>`<img data-fig="${esc(f)}" alt="Figura da questão" class="es-fig">`).join('');
  const fonteG=(BQ.pv[q.p]||{}).gst;
  const fb=mostra?`<section class="es-fb ${r.ok?'ok':'no'}"><b>${r.ok?I('circle-check-big')+'Acertou':I('x')+`Errou · a certa é a ${q.g}`}</b>
      ${q.c?`<div class="es-com">${negrito(q.c)}</div>`:`<p class="mx-dica">Comentário desta questão ainda não escrito.</p>`}
      <p class="es-gst">${fonteG==='definitivo'?'Gabarito oficial definitivo da banca':fonteG==='preliminar'?'Gabarito oficial preliminar da banca':'Gabarito conferido pelo Claude (o oficial não foi encontrado)'}${q.cv==='diverge'?' · atenção: o Claude discorda do gabarito, veja o comentário':''}</p>
      <div class="mx-acoes">${r.ok?'':`<button class="mx-btn sec" data-acao="q-erro">${I('pen')}Anotar o erro</button>`}${q.tx||(q.fig&&q.fig.length)?'':`<button class="mx-btn sec" data-acao="q-card">${I('brain')}Virar card</button>`}</div></section>`:'';
  const pe=ses.prova?`<button class="mx-btn" data-acao="q-resp" ${ses.sel?'':'disabled'}>${ses.i<ses.ids.length-1?'Marcar e seguir':'Marcar e ver o resumo'}${I('arrow-right')}</button>`
    :mostra?`<button class="mx-btn" data-acao="q-prox">${ses.i<ses.ids.length-1?'Próxima':'Ver o resultado'}${I('arrow-right')}</button>`
    :`<button class="mx-btn" data-acao="q-resp" ${ses.sel?'':'disabled'}>Responder</button>`;
  return `${barraTopo(ses.i+(r?1:0),ses.ids.length,relogio)}
  <div class="es-corpo ${tx?'com-texto':''}"><div class="es-col">
    ${tx?`<aside class="es-ladotx">${textoHtml(tx,txAberto,q.tx)}</aside>`:''}
    <article class="es-q">${metaQ(q)}
      <div class="es-enun">${nl2br(q.e)}</div>${fig}
      <ol class="es-alts">${alts}</ol>${fb}
    </article></div></div>
  <footer class="es-pe">${ses.i>0&&!ses.prova?'':''}${pe}</footer>`;
}
function htmlGrade(){
  const falta=ses.ids.filter(id=>!ses.resp[id]).length;
  return `${barraTopo(ses.ids.length-falta,ses.ids.length,`<span class="es-tempo" data-es-tempo>${X.mmss(Date.now()-ses.ini)}</span>`)}
  <div class="es-corpo"><div class="es-col1"><h2 class="es-h">${falta?`Faltam ${falta} ${falta===1?'questão':'questões'}`:'Todas marcadas'}</h2>
    <p class="mx-dica">Toque num número para voltar nele. Na prova de verdade, questão em branco é ponto perdido: chute com critério.</p>
    <div class="es-grade">${ses.ids.map((id,i)=>`<button data-acao="q-ir" data-i="${i}" class="${ses.resp[id]?'ok':''}">${QID[id].n}</button>`).join('')}</div></div></div>
  <footer class="es-pe"><button class="mx-btn sec" data-acao="q-voltar">${I('arrow-left')}Continuar a prova</button><button class="mx-btn" data-acao="q-entregar">${I('flag')}Entregar</button></footer>`;
}
function htmlFimQuiz(){
  const l=ses.ids.map(id=>QID[id]); const feitas=l.filter(q=>ses.resp[q.id]); const ac=feitas.filter(q=>ses.resp[q.id].ok);
  const base=ses.prova?l.length:feitas.length; const brancos=l.length-feitas.length;
  const p=base?ac.length/base:0; const seg=Math.round((Date.now()-ses.ini)/1000);
  const por={}; (ses.prova?l:feitas).forEach(q=>{const t=topico(q.t);const k=ses.prova?t.mat:t.as;const x=por[k]=por[k]||[0,0];x[0]+=ses.resp[q.id]?ses.resp[q.id].ok:0;x[1]++;});
  const erradas=feitas.filter(q=>!ses.resp[q.id].ok);
  const o=ses.spec.orig||''; let acaoOrig='';
  if(o.startsWith('r:')&&feitas.length) acaoOrig=`<button class="mx-btn" data-acao="q-rv" data-u="${esc(o.slice(2))}" data-a="${ac.length}" data-t="${feitas.length}">${I('check')}Concluir a revisão com ${ac.length} de ${feitas.length}</button>`;
  const msg=ses.prova?`Nota: ${ac.length} de ${l.length}${brancos?` (${brancos} em branco contam como erro)`:''}. Abaixo, onde você perdeu mais pontos: é por ali que a revisão começa.`
    :p>=0.85?'Mandou bem. Esse assunto está firme.':p>=0.6?'Bom. Leia os comentários das que errou.':'Abaixo de 60%: o assunto volta mais cedo. É assim que fecha o buraco.';
  return `${barraTopo(feitas.length,ses.ids.length)}
  <div class="es-corpo"><div class="es-col1">
    <section class="es-fim"><div class="es-anel">${X.anel(p,120)}<b>${Math.round(p*100)}%<i>${ac.length} de ${base}</i></b></div>
      <div><h2 class="es-h">${ses.prova?'Prova entregue':'Fim das questões'}</h2><p>${msg}</p><p class="mx-dica">${tempo(seg)} · ${feitas.length?Math.round(seg/feitas.length):0} s por questão${ses.prova?' (na prova, conte uns 2 min por questão com a redação)':''}</p></div></section>
    ${Object.keys(por).length>1?`<section class="mx-card"><h3 class="mx-h3">${I('target')}Por ${ses.prova?'matéria':'assunto'}</h3><ul class="mx-mats">${Object.entries(por).sort((a,b)=>a[1][0]/a[1][1]-b[1][0]/b[1][1]).map(([k,v])=>`<li><span>${esc(k)}</span>${X.barra(v[0]/v[1],v[0]/v[1]<0.6?'ro':v[0]/v[1]<0.8?'am':'em')}<b>${v[0]}/${v[1]}</b></li>`).join('')}</ul></section>`:''}
    ${erradas.length?`<section class="mx-card"><h3 class="mx-h3">${I('rotate-ccw')}Para rever <i>voltam em 2 dias na fila de erros</i></h3><ul class="es-errs">${erradas.map(q=>`<li><button data-acao="q-rever" data-id="${q.id}"><b>Q${q.n} · ${esc(topico(q.t).as)}</b><i>marquei ${ses.resp[q.id].m}, certa ${q.g}</i></button></li>`).join('')}</ul></section>`:''}
  </div></div>
  <footer class="es-pe">${erradas.length?`<button class="mx-btn sec" data-acao="q-refazer">${I('rotate-ccw')}Refazer as erradas</button>`:''}${acaoOrig||`<button class="mx-btn" data-acao="s-sair">${I('check')}Voltar</button>`}</footer>`;
}
function htmlCards(){
  if(ses.fim){const n=ses.feitos.filter(x=>!x[2]).length; const seg=Math.round((Date.now()-ses.ini)/1000); const er=ses.erros;
    const f=filaCards();
    return `${barraTopo(ses.fila.length,ses.fila.length)}<div class="es-corpo"><div class="es-col1"><section class="es-fim">${I('trophy')}<div><h2 class="es-h">Cards feitos</h2>
      <p>${ses.feitos.length} respostas em ${tempo(seg)}${er?` · ${er} ${er===1?'erro voltou':'erros voltaram'} na sessão`:''}.</p>
      <p class="mx-dica">${f.rev.length||f.novos.length?`Ainda há ${f.rev.length+f.novos.length} para hoje.`:'Nada mais para hoje. Amanhã o Mentor traz os que vencerem.'}</p></div></section></div></div>
      <footer class="es-pe">${ses.ultimo?`<button class="mx-btn sec" data-acao="c-desfazer">${I('undo')}Desfazer o último</button>`:''}<button class="mx-btn" data-acao="s-sair">${I('check')}Voltar</button></footer>`;}
  const card=cardAtual(); if(!card){ses.fim=1;return htmlCards();}
  const c=C(); const st=c.c[card.id]||null; const d=DECK[card.b]||{nome:'Meus cards',mat:'',alvo:''};
  const novo=!st; const refaz=ses.refazer[card.id];
  const meta=`<div class="es-meta"><span class="mx-chip">${esc(d.nome)}</span>${d.alvo?alvoChip(d.alvo):''}${novo?'<span class="es-novo">novo</span>':''}${refaz?'<span class="es-novo am">de novo</span>':''}</div>`;
  let frente='', verso='', botoes='';
  const notas=g=>refaz?'':`<i>${ivlTxt(st,g)}</i>`;
  const quatro=`<div class="es-notas"><button data-acao="c-nota" data-g="1" class="n1"><b>Errei</b>${refaz?'':'<i>amanhã</i>'}</button><button data-acao="c-nota" data-g="2" class="n2"><b>Difícil</b>${notas(2)}</button><button data-acao="c-nota" data-g="3" class="n3"><b>Bom</b>${notas(3)}</button><button data-acao="c-nota" data-g="4" class="n4"><b>Fácil</b>${notas(4)}</button></div>`;
  if(card.k==='ce'){
    frente=`<p class="es-tema">${esc(card.t||'')}</p><div class="es-item">${esc(card.f)}</div>`;
    if(ses.resp==null) botoes=`<div class="es-ce"><button data-acao="c-ce" data-v="1" class="c">${I('check')}Certo</button><button data-acao="c-ce" data-v="0" class="e">${I('x')}Errado</button></div>`;
    else{const acertou=(ses.resp===1)===!!card.g;
      verso=`<section class="es-fb ${acertou?'ok':'no'}"><b>${acertou?I('circle-check-big')+'Acertou':I('x')+'Errou'} · gabarito: ${card.g?'Certo':'Errado'}</b><div class="es-com">${card.j}</div></section>`;
      botoes=acertou?`<div class="es-notas tres"><button data-acao="c-nota" data-g="2" class="n2"><b>Difícil</b>${notas(2)}</button><button data-acao="c-nota" data-g="3" class="n3"><b>Bom</b>${notas(3)}</button><button data-acao="c-nota" data-g="4" class="n4"><b>Fácil</b>${notas(4)}</button></div>`
        :`<div class="es-notas um"><button data-acao="c-nota" data-g="1" class="n1"><b>Continuar</b><i>volta daqui a pouco e amanhã</i></button></div>`;}
  } else if(card.k==='termo'){
    const tr=esc(card.tr||''); const rx=new RegExp('('+card.f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','i');
    frente=`<p class="es-tema">Dicionário das provas · o que significa?</p><div class="es-termo">${esc(card.f)}</div>${tr?`<blockquote class="es-trecho">“${tr.replace(rx,'<mark>$1</mark>')}”<cite>${esc(card.fo||'')}</cite></blockquote>`:''}`;
    if(ses.virado){verso=`<section class="es-verso"><p><b>Significa:</b> ${esc(card.v)}</p>${card.ex?`<p><b>Exemplo:</b> ${esc(card.ex)}</p>`:''}${card.p?`<p class="es-pega"><b>Na prova:</b> ${esc(card.p)}</p>`:''}</section>`;botoes=quatro;}
    else botoes=`<div class="es-notas um"><button data-acao="c-virar" class="n3"><b>Mostrar a resposta</b><i>tente lembrar antes</i></button></div>`;
  } else {
    frente=`<p class="es-tema">${card.meu?'Meu card':'Frente e verso'}</p><div class="es-item">${card.meu?nl2br(card.f):card.f}</div>`;
    if(ses.virado){verso=`<section class="es-verso"><div>${card.meu?nl2br(card.v):card.v}</div>${card.p?(card.meu?`<p class="mx-dica">Fonte: ${esc(card.p)}</p>`:`<p class="es-pega"><b>Na prova:</b> ${card.p}</p>`):''}</section>`;botoes=quatro;}
    else botoes=`<div class="es-notas um"><button data-acao="c-virar" class="n3"><b>Mostrar a resposta</b><i>tente lembrar antes</i></button></div>`;
  }
  const dir=ses.ultimo?`<button class="es-x" data-acao="c-desfazer" aria-label="Desfazer o último" title="Desfazer o último">${I('undo')}</button>`:'';
  return `${barraTopo(ses.i,ses.fila.length,dir)}<div class="es-corpo"><div class="es-col1"><article class="es-card">${meta}${frente}${verso}</article></div></div><footer class="es-pe col">${botoes}</footer>`;
}

/* ================================================================ desenho: abas */
function semBancoHtml(){
  if(!EJ||!EJ.banco) return `<section class="mx-card"><b>O banco de questões está sendo montado.</b><p class="mx-dica">As provas de Soldado e do CFO entram aqui assim que os gabaritos e comentários estiverem conferidos.</p></section>`;
  if(bancoErro==='chave'||bancoErro==='chave-errada') return `<section class="mx-card es-ativar"><h2 class="mx-h3">${I('lock')}Ativar o banco de questões</h2>
    <p>O texto das provas fica trancado no site. Para abrir, use o link de ativação que o Claude mandou no chat do projeto (é uma vez só, vale para o celular e o computador).</p>
    ${bancoErro==='chave-errada'?'<p class="mx-dica" style="color:var(--red400)">Essa chave não abriu o banco. Confira se copiou inteira.</p>':''}
    <div class="es-chave"><input class="mx-in" data-chave placeholder="ou cole a chave aqui" autocomplete="off" spellcheck="false"><button class="mx-btn" data-acao="q-chave">${I('check')}Ativar</button></div></section>`;
  return `<section class="mx-card"><b>Abrindo o banco de questões…</b>${bancoErro?`<p class="mx-dica">${esc(bancoErro)}</p>`:''}</section>`;
}
function unidadesEstudadas(){
  const s=X.S(); const us=new Set();
  X.MJ.fichas.forEach(f=>{if(s.fd[f.id]&&f.u)us.add(f.u);});
  X.MJ.trilha.forEach(t=>{if(s.td[t.id]&&t.u)us.add(t.u);});
  const e=X.RV.e(); Object.keys(e.f).forEach(k=>us.add(k.split('|')[1]));
  EJ.decks.forEach(d=>{if(d.u&&d.tipo!=='termo')us.add(d.u);});
  return [...us].filter(u=>X.U(u));
}
function unidadesDeHoje(){
  const P=X.plano(); const us=new Set();
  P.ets.forEach(et=>{if(et.t&&et.t.u)us.add(et.t.u); if(et.f&&et.f.u)us.add(et.f.u); (et.rev||[]).forEach(p=>us.add(p.u));});
  return [...us];
}
function vQuestoes(){
  if(!EJ) return '<section class="mx-card">Carregando…</section>';
  const cab=`<header class="mx-cab"><h1>Questões</h1><p>Só provas da PMBA: ${EJ.nSD} questões de Soldado e ${EJ.nCFO} do CFO, com gabarito oficial e o comentário de cada uma. É o filtro mais certeiro que existe para o seu objetivo.</p></header>`;
  if(!BQ) return cab+semBancoHtml();
  const st=Q(); const alvo=alvoAtual(st);
  const venc=Object.entries(st.qd).filter(([id,d])=>d<=H()&&QID[id]).length;
  const totErr=Object.keys(st.qd).filter(id=>QID[id]).length;
  const hoje=unidadesDeHoje(); const nHoje=hoje.length?candidatos({us:hoje}).length:0;
  const estud=unidadesEstudadas(); const nEst=estud.length?candidatos({us:estud,alvo}).length:0;
  const feitas=Object.keys(st.r).filter(id=>QID[id]); const ac=feitas.filter(id=>st.r[id][2]).length;
  const mats=[...new Set(EJ.topicos.filter(t=>(t.alvo||'SD').includes(alvo==='AMBOS'?'':alvo)||alvo==='AMBOS').map(t=>t.mat))].sort();
  const tops=EJ.topicos.filter(t=>(!filtro.mat||t.mat===filtro.mat)&&(alvo==='AMBOS'||(t.alvo||'SD').includes(alvo))).map(t=>[t,BQ.q.filter(q=>q.t===t.k&&valida(q)).length]).filter(x=>x[1]>0);
  const specF={mat:filtro.t?'':filtro.mat,t:filtro.t||undefined,so:filtro.so,n:filtro.n,alvo};
  const nF=candidatos(specF).length;
  const provas=BQ.provas.slice().sort((a,b)=>(a.conc===b.conc?b.ano-a.ano:a.conc==='SD'?-1:1));
  return cab+`
  <div class="es-seg" role="group" aria-label="Objetivo">${[['SD','Soldado'],['CFO','CFO'],['AMBOS','Os dois']].map(([k,t])=>`<button data-acao="q-alvo" data-v="${k}" aria-pressed="${alvo===k}">${t}</button>`).join('')}</div>
  <p class="mx-dica es-alvo-d">${alvo==='SD'?'Assuntos que caem no Soldado, das provas de Soldado e também do CFO (mesmo assunto, banca diferente: treino extra).':alvo==='CFO'?'Assuntos que caem no CFO, incluindo os que só o CFO cobra (Inglês, Processo Penal, História e Geografia Gerais, Matemática do ensino médio).':'Tudo o que cai no Soldado ou no CFO.'}</p>
  <div class="es-atalhos">
    <button class="es-at-b ${venc?'forte':''}" data-acao="q-abrir" data-spec='${esc(JSON.stringify({so:'vencidas',n:30,alvo:'AMBOS'}))}' ${venc?'':'disabled'}>${I('rotate-ccw')}<b>Revisar erros</b><i>${venc?`${venc} para hoje`:totErr?`${totErr} na fila, nenhuma para hoje`:'nenhum erro na fila'}</i></button>
    <button class="es-at-b" data-acao="q-abrir" data-spec='${esc(JSON.stringify({us:hoje,n:15,mix:true,orig:'dia'}))}' ${nHoje?'':'disabled'}>${I('sunrise')}<b>Assuntos de hoje</b><i>${nHoje?`${Math.min(15,nHoje)} de ${nHoje} questões`:'sem questão da PMBA nos assuntos de hoje'}</i></button>
    <button class="es-at-b" data-acao="q-abrir" data-spec='${esc(JSON.stringify({us:estud,n:20,mix:true,alvo}))}' ${nEst?'':'disabled'}>${I('layers')}<b>Mista do que já estudei</b><i>${nEst} questões de ${estud.length} assuntos</i></button>
  </div>
  <section class="mx-card"><h2 class="mx-h3">${I('list-checks')}Montar um caderno</h2>
    <div class="es-form">
      <label><span>Matéria</span><select class="mx-in" data-f="mat"><option value="">Todas</option>${mats.map(m=>`<option ${filtro.mat===m?'selected':''}>${esc(m)}</option>`).join('')}</select></label>
      <label><span>Assunto</span><select class="mx-in" data-f="t"><option value="">Todos${filtro.mat?' da matéria':''}</option>${tops.map(([t,n])=>`<option value="${esc(t.k)}" ${filtro.t===t.k?'selected':''}>${esc(t.as)} (${n})${t.alvo==='CFO'?' · só CFO':''}</option>`).join('')}</select></label>
      <label><span>Quais</span><select class="mx-in" data-f="so">${[['novas','Inéditas para mim'],['erros','Só as que errei'],['todas','Todas']].map(([k,t])=>`<option value="${k}" ${filtro.so===k?'selected':''}>${t}</option>`).join('')}</select></label>
      <label><span>Quantas</span><select class="mx-in" data-f="n">${[5,10,20,30,50].map(n=>`<option ${filtro.n===n?'selected':''}>${n}</option>`).join('')}</select></label>
    </div>
    <div class="mx-acoes"><button class="mx-btn" data-acao="q-abrir" data-spec='${esc(JSON.stringify(specF))}' ${nF?'':'disabled'}>${I('play')}Começar (${Math.min(filtro.n,nF)} de ${nF})</button></div></section>
  <section class="mx-card"><h2 class="mx-h3">${I('clipboard-check')}Simulado: a prova inteira <i>sem comentário até entregar</i></h2>
    <p class="mx-dica">Faça com relógio, de uma vez, como no dia. Melhor na reta final (março), uma por semana.</p>
    <ul class="es-provas">${provas.map(p=>{const r=st.sim[p.id];const n=BQ.q.filter(q=>q.p===p.id&&valida(q)).length;return `<li><span><b>${p.conc==='SD'?'Soldado':'CFO'} ${p.ano} · ${esc(p.banca)}</b><i>${n} questões${r?` · feita ${X.dd(r[0])}: ${r[1]} de ${r[2]} (${pctN(r[1],r[2])}%)`:''}</i></span><button class="mx-mini" data-acao="q-abrir" data-spec='${esc(JSON.stringify({prova:p.id}))}'>${r?'Refazer':'Fazer'}</button></li>`;}).join('')}</ul></section>
  ${desempenhoQ(st,feitas,ac)}`;
}
function desempenhoQ(st,feitas,ac){
  if(!feitas.length) return `<section class="mx-card"><h2 class="mx-h3">${I('target')}Desempenho</h2><p class="mx-vazio">Aparece aqui conforme você resolve.</p></section>`;
  const por={}; feitas.forEach(id=>{const q=QID[id];const t=topico(q.t);const x=por[t.mat]=por[t.mat]||[0,0];x[0]+=st.r[id][2];x[1]++;});
  const tps={}; feitas.forEach(id=>{const q=QID[id];const x=tps[q.t]=tps[q.t]||[0,0];x[0]+=st.r[id][2];x[1]++;});
  const fracos=Object.entries(tps).filter(([k,v])=>v[1]>=4).sort((a,b)=>a[1][0]/a[1][1]-b[1][0]/b[1][1]).slice(0,5);
  return `<section class="mx-card"><h2 class="mx-h3">${I('target')}Desempenho <i>${feitas.length} resolvidas · ${pctN(ac,feitas.length)}%</i></h2>
    <ul class="mx-mats">${Object.entries(por).sort((a,b)=>b[1][1]-a[1][1]).map(([m,v])=>{const p=v[0]/v[1];return `<li><span>${esc(m)}</span>${X.barra(p,p<0.6?'ro':p<0.8?'am':'em')}<b>${Math.round(p*100)}%</b></li>`;}).join('')}</ul>
    ${fracos.length?`<p class="mx-dica">Mais fracos: ${fracos.map(([k,v])=>`${esc(topico(k).as)} (${pctN(v[0],v[1])}%)`).join(' · ')}</p>`:''}</section>`;
}
function vCards(){
  if(!EJ) return '<section class="mx-card">Carregando…</section>';
  const c=C();
  const cab=`<header class="mx-cab"><h1>Cards</h1><p>Os Certo/Errado das fichas, o dicionário das provas e os seus cards, com repetição espaçada: cada card volta na hora em que você ia esquecer.</p></header>`;
  if(!c.m) return cab+`<section class="mx-card es-ativar"><h2 class="mx-h3">${I('brain')}Trazer os cards para o Mentor</h2>
    <p>São ${EJ.cards.length} cards: ${EJ.cards.filter(x=>x.k!=='termo').length} de conteúdo (os mesmos baralhos que você importou no Anki) e ${EJ.cards.filter(x=>x.k==='termo').length} do dicionário de termos das provas.</p>
    <ol class="mx-simples"><li><b>Já estudo esses baralhos no Anki</b>: os de conteúdo entram como vistos e voltam espalhados nos próximos 14 dias. O dicionário entra aos poucos.</li><li><b>Começar do zero</b>: tudo entra como novo, ${c.novos} por dia.</li></ol>
    <div class="mx-acoes"><button class="mx-btn" data-acao="c-modo" data-v="anki">${I('check')}Já estudo no Anki</button><button class="mx-btn sec" data-acao="c-modo" data-v="zero">Começar do zero</button></div>
    <p class="mx-dica">Depois disso, o aquecimento do dia na Missão passa a ser aqui e o Anki fica opcional. <button class="mx-pedir" data-acao="c-modo" data-v="fora" style="margin:0">Prefiro continuar só no Anki</button></p></section>`;
  const f=filaCards(c); const n=f.rev.length+f.novos.length;
  const hj=hojeN(); const porDeck={};
  todosCards(c).forEach(x=>{const d=porDeck[x.b]=porDeck[x.b]||[0,0,0];const st=c.c[x.id];if(!st)d[0]++;else if(st[2]<=hj)d[1]++;d[2]++;});
  EJ.cards.filter(x=>c.off[x.b]).forEach(x=>{const d=porDeck[x.b]=porDeck[x.b]||[0,0,0];d[2]++;});
  const ult30=Object.entries(c.dia).filter(([d])=>X.entre(d,H())<=30); const r30=ult30.reduce((a,[d,v])=>[a[0]+v[0],a[1]+v[2]],[0,0]);
  const maduros=Object.values(c.c).filter(s=>s[0]>=21).length;
  const grupos={}; EJ.decks.forEach(d=>{(grupos[d.mat]=grupos[d.mat]||[]).push(d);});
  const linhaDeck=d=>{const x=porDeck[d.id]||[0,0,0];const off=!!c.off[d.id];return `<li class="${off?'off':''}"><span class="mx-lt"><b>${esc(d.nome)}</b><i>${x[2]} cards${off?' · pausado':` · ${x[1]} para hoje · ${x[0]} novos`}</i></span>${d.alvo?alvoChip(d.alvo):''}<button class="mx-mini" data-acao="c-deck" data-id="${d.id}" ${off?'disabled':''} title="Estudar só este baralho">${I('play')}</button><button class="mx-mini" data-acao="c-off" data-id="${d.id}">${off?'Ativar':'Pausar'}</button></li>`;};
  return cab+`
  <section class="mx-card es-hoje"><div class="es-cnum grande"><div><b>${f.rev.length}</b><i>revisões</i></div><div><b>${f.novos.length}</b><i>novos</i></div><div><b>${f.minutos}</b><i>min</i></div></div>
    ${n?`<button class="mx-btn" data-acao="c-estudar">${I('play')}Estudar agora</button>`:`<p class="mx-ok">${I('circle-check-big')}<span>${f.feitosHoje?`${f.feitosHoje} feitos hoje. Tudo em dia.`:'Nada vencido hoje.'}</span></p>`}
    <div class="mx-horas mini es-nd" role="group" aria-label="Novos por dia"><span>Novos por dia</span>${[0,10,15,20,30].map(k=>`<button data-acao="c-novos" data-v="${k}" aria-pressed="${c.novos===k}">${k}</button>`).join('')}</div></section>
  <section class="mx-resumo mx-card"><div><span class="mx-rot">Acerto 30 dias</span><b>${r30[0]?Math.round((1-r30[1]/r30[0])*100)+'%':'—'}</b></div><div><span class="mx-rot">Maduros</span><b>${maduros}<i>de ${f.todos}</i></b></div><div><span class="mx-rot">Feitos hoje</span><b>${f.feitosHoje}</b></div></section>
  <section class="mx-card"><h2 class="mx-h3">${I('pen')}Meus cards <i>${c.meus.length}</i></h2>
    <div class="es-novo-card"><textarea class="mx-in" data-mf rows="2" maxlength="600" placeholder="Frente: a pergunta ou o trecho"></textarea><textarea class="mx-in" data-mv rows="2" maxlength="900" placeholder="Verso: a resposta"></textarea><button class="mx-btn sec" data-acao="c-criar">${I('plus')}Criar card</button></div>
    ${c.meus.length?`<ul class="mx-erros">${c.meus.slice(-8).reverse().map(m=>`<li><span>${esc(m.f.slice(0,120))}<i> → ${esc(m.v.slice(0,80))}</i></span><button data-acao="c-del" data-id="${m.id}" aria-label="Apagar">${I('x')}</button></li>`).join('')}</ul>`:'<p class="mx-dica">Escreva com as suas palavras: a frente pergunta, o verso responde curto. Nas questões, o botão "Virar card" já monta um pronto.</p>'}</section>
  <section class="mx-card"><h2 class="mx-h3">${I('layers')}Baralhos</h2>
    ${Object.entries(grupos).map(([m,l])=>{const tot=l.reduce((a,d)=>a+((porDeck[d.id]||[0,0,0])[2]),0),hj2=l.reduce((a,d)=>a+((porDeck[d.id]||[0,0,0])[1]),0);
      return `<details class="es-gdeck"><summary><b>${esc(m)}</b><i>${l.length} ${l.length===1?'baralho':'baralhos'} · ${tot} cards${hj2?` · ${hj2} para hoje`:''}</i>${I('chevron-down','mx-seta')}</summary><ul class="mx-lista es-decks">${l.map(linhaDeck).join('')}</ul></details>`;}).join('')}</section>
  <p class="mx-dica" style="text-align:center">${c.m==='fora'?'Você escolheu continuar no Anki. ':''}<button class="mx-pedir" data-acao="c-modo" data-v="${c.m==='fora'?'zero':'fora'}">${c.m==='fora'?'Usar os cards aqui no Mentor':'Voltar a usar só o Anki'}</button></p>`;
}
/* alvo: o que cai no Soldado e no CFO, assunto por assunto */
function vAlvo(){
  if(!EJ) return '<section class="mx-card">Carregando…</section>';
  const por={}; EJ.topicos.filter(t=>t.sd||t.cfo).forEach(t=>{(por[t.mat]=por[t.mat]||[]).push(t);});
  const tot=(l,k)=>l.reduce((a,t)=>a+t[k],0);
  const mats=Object.entries(por).sort((a,b)=>(tot(b[1],'sd')+tot(b[1],'cfo'))-(tot(a[1],'sd')+tot(a[1],'cfo')));
  const so=EJ.topicos.filter(t=>t.alvo==='CFO');
  return `<section class="mx-card"><h2 class="mx-h3">${I('target')}O alvo de cada prova</h2>
    <p class="mx-dica">Percentual das questões de ${EJ.nSD} questões de Soldado (6 provas, 2007 a 2022) e ${EJ.nCFO} do CFO (7 provas, 2010 a 2025). ${alvoChip('SDCFO')} cai nos dois, ${alvoChip('SD')} só no Soldado, ${alvoChip('CFO')} só no CFO.</p>
    <div class="es-so"><b>Só o CFO cobra (fica para fevereiro):</b> ${so.map(t=>`${esc(t.as)} (${String(t.cfop).replace('.',',')}%)`).join(' · ')}</div></section>
  ${mats.map(([m,l],i)=>`<details class="mx-card es-gdeck" ${i<2?'open':''}><summary><b>${esc(m)}</b><i>SD ${String(Math.round(l.reduce((a,t)=>a+t.sdp,0)*10)/10).replace('.',',')}% · CFO ${String(Math.round(l.reduce((a,t)=>a+t.cfop,0)*10)/10).replace('.',',')}%</i>${I('chevron-down','mx-seta')}</summary>
    <ul class="es-alvos"><li class="cab"><span>Assunto</span><span></span><span></span><b>SD %</b><span></span><b>CFO %</b></li>${l.sort((a,b)=>(b.sdp+b.cfop)-(a.sdp+a.cfop)).map(t=>`<li><span>${esc(t.as)}</span>${alvoChip(t.alvo)}<span class="es-dup"><i style="width:${Math.min(100,t.sdp*12)}%" class="sd"></i></span><b>${t.sd?String(t.sdp).replace('.',','):'—'}</b><span class="es-dup"><i style="width:${Math.min(100,t.cfop*12)}%" class="cfo"></i></span><b>${t.cfo?String(t.cfop).replace('.',','):'—'}</b></li>`).join('')}</ul></details>`).join('')}`;
}

/* ================================================================ cliques */
async function clique(ev){
  const im=ev.target.closest('img.es-fig'); if(im&&im.src){ampliar(im.src);return true;}
  const b=ev.target.closest('[data-acao]'); if(!b) return false;
  return acao(b.dataset.acao,b,ev);
}
function acao(a,b){
  switch(a){
    case 's-sair': if(ses&&ses.tipo==='q'&&!ses.fim&&Object.keys(ses.resp).length&&ses.prova){ses.grade=1;desenharSes();return true;} fecharSes(); return true;
    case 'q-abrir': {let sp={};try{sp=JSON.parse(b.dataset.spec);}catch(_){} abrirQuiz(sp); return true;}
    case 'q-alt': if(!ses)return true; ses.sel=b.dataset.l; if(ses.risca[questaoAtual().id])delete ses.risca[questaoAtual().id][ses.sel]; desenharSes(); return true;
    case 'q-risca': {const q=questaoAtual();const r=ses.risca[q.id]=ses.risca[q.id]||{};r[b.dataset.l]=!r[b.dataset.l];if(r[b.dataset.l]&&ses.sel===b.dataset.l)ses.sel=null;desenharSes();return true;}
    case 'q-resp': responder(); return true;
    case 'q-prox': proxima(); return true;
    case 'q-grade': ses.grade=1; desenharSes(); return true;
    case 'q-voltar': ses.grade=0; desenharSes(); return true;
    case 'q-ir': ses.grade=0; ses.i=+b.dataset.i; ses.sel=(ses.resp[ses.ids[ses.i]]||{}).m||null; desenharSes(); return true;
    case 'q-entregar': ses.grade=0; fimQuiz(); return true;
    case 'q-rever': {const id=b.dataset.id; ses={tipo:'q',spec:{ids:[id]},ids:[id],i:0,resp:{[id]:Object.assign({},(ses.resp||{})[id])},ini:Date.now(),t0:Date.now(),risca:{},texto:{},volta:ses}; desenharSes(); return true;}
    case 'q-refazer': {const ids=ses.ids.filter(id=>ses.resp[id]&&!ses.resp[id].ok); abrirQuiz({ids}); return true;}
    case 'q-erro': {const q=questaoAtual();const r=ses.resp[q.id];const t=topico(q.t);const p=BQ.pv[q.p]||{};
      const certo=(q.a.find(x=>x[0]===q.g)||[])[1]||'';
      X.ER.add(t.u||null,'Questões · '+t.as,`${p.conc==='CFO'?'CFO':'SD'} ${p.ano} Q${q.n}: marquei ${r.m}, a certa é ${q.g}. ${semTag(q.e).replace(/\s+/g,' ').slice(0,110)}`,semTag(certo).replace(/\s+/g,' ').slice(0,200));
      X.aviso('Erro anotado: entra na lista para virar card','check'); b.disabled=true; b.textContent='Anotado'; return true;}
    case 'q-card': {const q=questaoAtual();const certo=(q.a.find(x=>x[0]===q.g)||[])[1]||'';const p=BQ.pv[q.p]||{};
      const tx=(q.e||'').trim(); const curtas=q.a.every(x=>x[1].length<60);
      const f=tx.slice(0,420)+(curtas?'\n\n'+q.a.map(x=>`(${x[0]}) ${x[1]}`).join('\n'):'');
      const c=C(); c.meus.push({id:'m'+Date.now().toString(36),f,v:`(${q.g}) ${certo}`+(q.c?'\n\n'+q.c.replace(/\*\*/g,'').slice(0,500):''),p:`${p.conc==='CFO'?'CFO':'Soldado'} ${p.ano} Q${q.n}`,u:topico(q.t).u||null,dt:H(),src:q.id});
      salvarC(c); X.aviso('Card criado: entra nos seus novos (aba Cards)','brain'); b.disabled=true; b.textContent='Card criado'; return true;}
    case 'q-rv': {const u=b.dataset.u;const P=X.RV.pendentes(X.RV.e());const p=P.find(x=>x.u===u);
      if(!p){X.aviso('Essa revisão já foi concluída','check');fecharSes();return true;}
      const m=X.RV.concluir(p,+b.dataset.a,+b.dataset.t); fecharSes(); X.aviso(m,+b.dataset.a/+b.dataset.t<0.6?'rotate-ccw':'circle-check-big'); X.depoisRev&&X.depoisRev(); return true;}
    case 'q-alvo': {const st=Q();st.cfg.alvo=b.dataset.v;salvarQ(st);filtro.t='';X.render();return true;}
    case 'q-chave': {const inp=document.querySelector('[data-chave]');const k=(inp&&inp.value||'').trim().replace(/^.*#k=/,'');if(k.length<30){X.aviso('A chave parece incompleta','zap');return true;}
      guardarChave(k);CK=null;bancoErro='';BQ=null;carregarBanco().then(()=>{X.aviso(BQ?'Banco de questões ativado':'Não abriu: confira a chave',BQ?'circle-check-big':'zap');X.render();});return true;}
    case 'c-estudar': abrirCards(); return true;
    case 'c-deck': abrirCards({deck:b.dataset.id}); return true;
    case 'c-ce': ses.resp=+b.dataset.v; desenharSes(); return true;
    case 'c-virar': ses.virado=true; desenharSes(); return true;
    case 'c-nota': avaliar(+b.dataset.g); return true;
    case 'c-desfazer': desfazerCard(); return true;
    case 'c-modo': {const c=C(); if(b.dataset.v==='anki'){const n=importarAnki();X.aviso(`${n} cards entraram como vistos; voltam nos próximos 14 dias`,'brain');}
      else {c.m=b.dataset.v==='fora'?'fora':'mentor'; salvarC(c);} X.render(); return true;}
    case 'c-novos': {const c=C();c.novos=+b.dataset.v;salvarC(c);X.render();return true;}
    case 'c-off': {const c=C();if(c.off[b.dataset.id])delete c.off[b.dataset.id];else c.off[b.dataset.id]=1;salvarC(c);X.render();return true;}
    case 'c-criar': {const box=b.closest('.es-novo-card');const f=box.querySelector('[data-mf]').value.trim(),v=box.querySelector('[data-mv]').value.trim();
      if(f.length<3||v.length<1){X.aviso('Escreva a frente e o verso','zap');return true;}
      const c=C();c.meus.push({id:'m'+Date.now().toString(36),f,v,dt:H()});salvarC(c);X.aviso('Card criado','check');X.render();return true;}
    case 'c-del': {const c=C();c.meus=c.meus.filter(m=>m.id!==b.dataset.id);delete c.c[b.dataset.id];salvarC(c);X.render();return true;}
  }
  return false;
}
function teclas(ev){
  if(!ses||ev.target.matches('input,textarea,select')) return;
  const k=ev.key.toLowerCase();
  if(k==='escape'){acao('s-sair',ev.target);return;}
  if(ses.tipo==='q'&&!ses.fim&&!ses.grade){const q=questaoAtual();const r=ses.resp[q.id];
    if(!r||ses.prova){const l=q.a.find(x=>x[0].toLowerCase()===k);if(l){ses.sel=l[0];desenharSes();ev.preventDefault();return;}}
    if(k==='enter'){ev.preventDefault();if(r&&!ses.prova)proxima();else responder();}}
  else if(ses.tipo==='c'&&!ses.fim){const card=cardAtual();if(!card)return;
    if(card.k==='ce'&&ses.resp==null){if(k==='c'){ses.resp=1;desenharSes();}else if(k==='e'){ses.resp=0;desenharSes();}return;}
    if(card.k!=='ce'&&!ses.virado){if(k===' '||k==='enter'){ev.preventDefault();ses.virado=true;desenharSes();}return;}
    if(['1','2','3','4'].includes(k)){const acertou=card.k!=='ce'||((ses.resp===1)===!!card.g);const g=+k;if(card.k==='ce'&&!acertou)return avaliar(1);if(card.k==='ce'&&g===1)return;avaliar(g);}
    else if(k===' '||k==='enter'){ev.preventDefault();const acertou=card.k!=='ce'||((ses.resp===1)===!!card.g);avaliar(acertou?3:1);}}
}

/* ================================================================ estilos */
const CSS=`
body.es-aberto{overflow:hidden}
#es-sessao{position:fixed;inset:0;z-index:90;background:var(--bg);display:flex;flex-direction:column;animation:entra .18s ease}
.es-topo{display:flex;align-items:center;gap:12px;padding:calc(10px + env(safe-area-inset-top,0px)) 14px 10px;border-bottom:.5px solid var(--line);background:var(--bg)}
.es-x{all:unset;cursor:pointer;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;color:var(--soft);flex:none}.es-x:hover{background:var(--hover)}
.es-prog{flex:1}.es-cont{font:700 13px/1 var(--mono);color:var(--soft);white-space:nowrap}
.es-tempo{font:800 14px/1 var(--mono);color:var(--amber400)}
.es-corpo{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:16px 16px 24px}
.es-col,.es-col1{max-width:760px;margin:0 auto}
@media (min-width:1000px){.es-corpo.com-texto .es-col{max-width:1180px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px;align-items:start}
  .es-ladotx{position:sticky;top:0;max-height:calc(100vh - 170px);overflow:auto}.es-ladotx .es-texto{margin:0}.es-ladotx .es-texto summary i{display:none}}
.es-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:12px}
.es-prova{font-size:11.5px;font-weight:850;padding:3px 9px;border-radius:999px;background:rgba(16,185,129,.13);color:var(--acc400)}.es-prova.cfo{background:rgba(167,139,250,.15);color:var(--mx-vi)}
.es-alvo{font-size:10.5px;font-weight:850;letter-spacing:.03em;padding:2px 7px;border-radius:6px;border:1px solid currentColor;white-space:nowrap}
.es-alvo.sd{color:var(--acc400)}.es-alvo.cfo{color:var(--mx-vi)}.es-alvo.ambos{color:var(--mx-cy)}
.es-texto{border:1px solid var(--border);border-radius:14px;background:var(--card);margin:0 0 14px}
.es-texto summary{cursor:pointer;display:flex;align-items:center;gap:8px;padding:12px 14px;list-style:none}.es-texto summary::-webkit-details-marker{display:none}
.es-texto summary b{flex:1;font-size:14px}.es-texto summary i{font-style:normal;font-size:12px;color:var(--muted)}
.es-tx-c{padding:0 16px 8px;font-size:15.5px;line-height:1.65;font-family:Georgia,'Times New Roman',serif}.es-tx-c p{margin:0 0 10px;text-indent:1.2em}
.es-tx-c.ln{counter-reset:l;display:flex;flex-direction:column}.es-tx-c.ln span{white-space:pre-wrap}
.es-tx-f{padding:0 16px 12px;font-size:12px;color:var(--muted);text-align:right}
.es-enun{font-size:16.5px;line-height:1.6;margin:0 0 12px}
.es-enun u,.es-at u,.es-tx-c u{text-decoration-thickness:2px;text-underline-offset:3px;text-decoration-color:var(--acc,#2dd4bf)}
.es-fig{display:block;max-width:100%;margin:8px auto 14px;border-radius:10px;background:#fff;min-height:40px;cursor:zoom-in}
.es-zoom{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.92);overflow:auto;-webkit-overflow-scrolling:touch;display:block;padding:64px 0 56px}
.es-zoom img{display:block;margin:0 auto;background:#fff;max-width:none!important;width:auto;height:auto;flex:none;padding:8px;box-sizing:content-box;cursor:zoom-out}
.es-zoom-x{position:fixed;top:12px;right:12px;width:44px;height:44px;border-radius:22px;border:0;background:rgba(255,255,255,.15);color:#fff;display:grid;place-items:center}
.es-zoom-dica{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);padding:6px 12px;border-radius:14px;background:rgba(0,0,0,.75);color:#eee;font-size:13px;white-space:nowrap;pointer-events:none}.es-fig.falhou{background:none;color:var(--muted);font-size:13px}
.es-alts{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.es-alt{display:flex;align-items:stretch;border:1.5px solid var(--border);border-radius:14px;background:var(--card);overflow:hidden;transition:border-color .12s,background .12s}
.es-alt-b{all:unset;box-sizing:border-box;cursor:pointer;flex:1;display:flex;gap:12px;align-items:flex-start;padding:12px 6px 12px 12px;min-height:48px}
.es-alt-b:disabled{cursor:default}
.es-l{width:28px;height:28px;border-radius:999px;border:1.5px solid var(--border);display:grid;place-items:center;font-weight:850;font-size:13px;flex:none;color:var(--soft)}
.es-at{font-size:15.5px;line-height:1.5;padding-top:3px}
.es-risca{all:unset;cursor:pointer;width:40px;display:grid;place-items:center;color:var(--muted);opacity:.55}.es-risca:hover{opacity:1}
.es-alt.sel{border-color:var(--acc);background:rgba(16,185,129,.08)}.es-alt.sel .es-l{background:var(--acc);border-color:var(--acc);color:#04130d}
.es-alt.riscada .es-at{text-decoration:line-through;color:var(--muted)}.es-alt.riscada .es-l{opacity:.4}
.es-alt.certa{border-color:var(--acc400);background:rgba(16,185,129,.12)}.es-alt.certa .es-l{background:var(--acc400);border-color:var(--acc400);color:#04130d}
.es-alt.errada{border-color:var(--red400);background:rgba(239,68,68,.1)}.es-alt.errada .es-l{background:var(--red400);border-color:var(--red400);color:#fff}
.es-fb{margin-top:14px;padding:14px;border-radius:14px;border:1px solid var(--border);background:var(--card)}
.es-fb>b{display:flex;align-items:center;gap:8px;font-size:16px;margin-bottom:6px}.es-fb.ok>b{color:var(--acc400)}.es-fb.no>b{color:var(--red400)}
.es-com{font-size:15px;line-height:1.6}.es-com b{color:var(--fg)}
.es-gst{font-size:12px;color:var(--muted);margin:10px 0 0}
.es-pe{display:flex;gap:10px;justify-content:flex-end;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));border-top:.5px solid var(--line);background:var(--bg)}
.es-pe .mx-btn{min-width:150px}.es-pe .mx-btn[disabled]{opacity:.4;pointer-events:none}
.es-pe.col{flex-direction:column;align-items:stretch}
@media (max-width:600px){.es-pe .mx-btn{flex:1;min-width:0}}
.es-fim{display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin:10px 0 14px}.es-fim>.mx-ic{width:44px;height:44px;color:var(--amber400)}
.es-anel{position:relative;width:120px;height:120px;flex:none}.es-anel b{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:26px;font-weight:850}.es-anel b i{font-style:normal;font-size:12px;color:var(--muted)}
.es-h{font-size:22px;font-weight:850;letter-spacing:-.02em;margin:0 0 4px}
.es-errs{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}.es-errs button{all:unset;box-sizing:border-box;cursor:pointer;width:100%;display:flex;flex-direction:column;padding:10px 12px;border-radius:10px;background:var(--bg2)}.es-errs i{font-style:normal;font-size:12.5px;color:var(--muted)}
.es-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:6px;margin-top:12px}.es-grade button{all:unset;cursor:pointer;text-align:center;padding:10px 0;border-radius:10px;border:1px solid var(--border);font:700 13px/1 var(--mono)}.es-grade button.ok{background:rgba(16,185,129,.15);border-color:var(--acc);color:var(--acc400)}
.es-card{border-radius:18px;background:var(--card);border:1px solid var(--border);padding:18px;min-height:200px}
.es-tema{font-size:11.5px;font-weight:800;letter-spacing:.06em;color:var(--muted);text-transform:uppercase;margin:0 0 10px}
.es-item{font-size:18px;line-height:1.6}
.es-termo{font-size:26px;font-weight:850;letter-spacing:-.01em;margin:4px 0 12px}
.es-trecho{margin:0;padding:10px 14px;border-left:3px solid var(--mx-cy);background:var(--bg2);border-radius:0 10px 10px 0;font-size:15px;line-height:1.55;color:var(--soft)}.es-trecho mark{background:rgba(251,191,36,.3);color:var(--fg);padding:0 2px;border-radius:3px}.es-trecho cite{display:block;font-style:normal;font-size:12px;color:var(--muted);margin-top:6px}
.es-verso{margin-top:16px;padding-top:14px;border-top:1px dashed var(--border);font-size:15.5px;line-height:1.6;display:flex;flex-direction:column;gap:8px}.es-verso p{margin:0}
.es-pega{padding:9px 12px;border-radius:10px;background:rgba(245,158,11,.1);color:var(--fg)}
.es-novo{font-size:10.5px;font-weight:850;padding:2px 7px;border-radius:6px;background:rgba(34,211,238,.15);color:var(--mx-cy)}.es-novo.am{background:rgba(245,158,11,.15);color:var(--amber400)}
.es-ce,.es-notas{display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:760px;width:100%;margin:0 auto}
.es-notas{grid-template-columns:repeat(4,1fr)}.es-notas.tres{grid-template-columns:repeat(3,1fr)}.es-notas.um{grid-template-columns:1fr}
.es-ce button,.es-notas button{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:56px;border-radius:14px;border:1.5px solid var(--border);font-weight:850;font-size:15px;text-align:center;padding:6px}
.es-ce button{flex-direction:row;gap:8px;font-size:17px;min-height:60px}
.es-ce .c{border-color:var(--acc);color:var(--acc400)}.es-ce .e{border-color:var(--red400);color:var(--red400)}
.es-notas i{font-style:normal;font-weight:600;font-size:11.5px;color:var(--muted)}
.es-notas .n1{color:var(--red400)}.es-notas .n2{color:var(--amber400)}.es-notas .n3{color:var(--acc400);border-color:var(--acc)}.es-notas .n4{color:var(--mx-cy)}
.es-cnum{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:4px 0 6px}.es-cnum>div{display:flex;flex-direction:column;align-items:center;padding:10px 0;border-radius:12px;background:var(--bg2)}.es-cnum b{font-size:24px;font-weight:850}.es-cnum i{font-style:normal;font-size:12px;color:var(--muted)}
.es-cnum.grande b{font-size:30px}
.es-hoje{display:flex;flex-direction:column;gap:12px}.es-hoje>.mx-btn{width:100%}
.es-seg{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:4px;border-radius:14px;background:var(--card);border:1px solid var(--border)}
.es-seg button{all:unset;cursor:pointer;text-align:center;padding:9px 0;border-radius:10px;font-weight:800;font-size:14px;color:var(--soft)}.es-seg button[aria-pressed=true]{background:var(--acc);color:#04130d}
.es-alvo-d{margin:8px 2px 14px}
.es-atalhos{display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:12px}@media (min-width:640px){.es-atalhos{grid-template-columns:repeat(3,1fr)}}
.es-at-b{all:unset;box-sizing:border-box;cursor:pointer;display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:10px;align-items:center;padding:14px;border-radius:16px;background:var(--card);border:1px solid var(--border)}
.es-at-b .mx-ic{grid-row:1/3;width:22px;height:22px;color:var(--acc400)}.es-at-b b{font-size:15px}.es-at-b i{font-style:normal;font-size:12.5px;color:var(--muted)}
.es-at-b.forte{border-color:var(--mx-ro);background:linear-gradient(135deg,rgba(251,113,133,.12),transparent)}.es-at-b.forte .mx-ic{color:var(--mx-ro)}
.es-at-b:disabled{opacity:.5;cursor:default}
.es-form{display:grid;grid-template-columns:1fr;gap:10px}@media (min-width:640px){.es-form{grid-template-columns:1fr 1fr}}
.es-form label{display:flex;flex-direction:column;gap:5px;font-size:12.5px;color:var(--muted);font-weight:700}.es-form select{width:100%}
.es-provas{list-style:none;margin:8px 0 0;padding:0}.es-provas li{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--border)}.es-provas li>span{flex:1;display:flex;flex-direction:column}.es-provas i{font-style:normal;font-size:12.5px;color:var(--muted)}
.es-qbt{margin:8px 0 4px;display:flex;flex-direction:column;align-items:flex-start;gap:2px}
.es-ativar p{font-size:14px;line-height:1.55;color:var(--soft);margin:0 0 10px}
.es-chave{display:flex;gap:8px;flex-wrap:wrap}.es-chave .mx-in{flex:1;min-width:200px}
.es-novo-card{display:grid;gap:7px;margin-bottom:8px}.es-novo-card textarea{resize:vertical;font-size:15px}
@media (min-width:640px){.es-novo-card{grid-template-columns:1fr 1fr auto;align-items:start}}
.es-grupo{margin:14px 0 0;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.es-decks li{gap:8px}.es-decks li.off .mx-lt b{color:var(--muted)}.es-decks .mx-mini[disabled]{opacity:.3}
.es-so{font-size:13.5px;line-height:1.55;color:var(--soft);padding:10px 12px;border-radius:10px;background:rgba(167,139,250,.08);margin-top:8px}
.es-alvos{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.es-alvos li{display:grid;grid-template-columns:minmax(0,1fr) auto 54px 34px 54px 34px;gap:8px;align-items:center;padding:7px 0;border-top:1px solid var(--border);font-size:13.5px}
.es-alvos b{font:700 12px/1 var(--mono);text-align:right;color:var(--soft)}
.es-dup{height:6px;border-radius:9px;background:var(--border);overflow:hidden}.es-dup i{display:block;height:100%}.es-dup i.sd{background:var(--acc400)}.es-dup i.cfo{background:var(--mx-vi)}
@media (max-width:420px){.es-alvos li{grid-template-columns:minmax(0,1fr) auto 30px 30px;}.es-alvos .es-dup{display:none}.es-termo{font-size:22px}.es-item{font-size:17px}}
.es-gdeck{border-top:1px solid var(--border)}.es-gdeck>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;padding:11px 0}.es-gdeck>summary::-webkit-details-marker{display:none}
.es-gdeck>summary b{font-size:14.5px}.es-gdeck>summary i{flex:1;font-style:normal;font-size:12.5px;color:var(--muted);text-align:right}.es-gdeck[open] .mx-seta{transform:rotate(180deg)}
details.mx-card.es-gdeck{border-top:1px solid var(--border);padding:4px 16px}details.mx-card.es-gdeck>summary b{font-size:15px}
.es-alvos li.cab{font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;border-top:0;padding-top:0}.es-alvos li.cab b{font:inherit;color:inherit}
.es-nd button{padding:5px 11px}
.mx-segp{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:4px;border-radius:14px;background:var(--card);border:1px solid var(--border);margin:0 0 14px}
.mx-segp button{all:unset;cursor:pointer;text-align:center;padding:9px 0;border-radius:10px;font-weight:800;font-size:13.5px;color:var(--soft)}.mx-segp button[aria-current=page]{background:var(--hover);color:var(--fg)}
`;

/* ================================================================ partida */
async function iniciar(){
  X=window.__mx;
  const st=document.createElement('style'); st.id='es-css'; st.textContent=CSS; document.head.appendChild(st);
  /* link de ativação: #k=CHAVE (só na primeira vez) */
  const m=(location.hash||'').match(/[#&]k=([A-Za-z0-9_-]{30,})/);
  if(m){guardarChave(m[1]);try{history.replaceState(null,'','#m-questoes');}catch(_){} X.aviso('Banco de questões ativado neste aparelho e na sua conta','circle-check-big');}
  document.addEventListener('keydown',teclas);
  document.addEventListener('toggle',ev=>{const d=ev.target;if(ses&&d&&d.dataset&&d.dataset.tx){ses.txOpen=ses.txOpen||{};ses.txOpen[d.dataset.tx]=d.open;}},true);
  document.addEventListener('change',ev=>{const el=ev.target;if(el&&el.dataset&&el.dataset.f){const k=el.dataset.f;filtro[k]=k==='n'?+el.value:el.value;if(k==='mat')filtro.t='';X.render();}});
  setInterval(()=>{const el=ov&&ov.querySelector('[data-es-tempo]');if(el&&ses)el.textContent=X.mmss(Date.now()-ses.ini);},1000);
  try{EJ=await fetch('/mentor/estudo.json?v='+(window.__REV2_V||VERSAO),{cache:'no-cache'}).then(r=>r.ok?r.json():null);}catch(_){EJ=null;}
  if(EJ){EJ.topicos.forEach(t=>{TOPK[t.k]=t;});EJ.decks.forEach(d=>{DECK[d.id]=d;});DECK.meus={id:'meus',nome:'Meus cards',mat:'',alvo:'',f:1,pp:9};EJ.cards.forEach(c=>{CARD[c.id]=c;});}
  window.__estudo.pronto=!!EJ; X.render();
  await carregarBanco(); X.render();
  /* volta para a sessão aberta se a página recarregou no meio */
  try{const s=JSON.parse(sessionStorage.getItem('es_ses')||'null');if(s&&!s.fim&&((s.tipo==='q'&&BQ)||s.tipo==='c')){ses=s;desenharSes();}}catch(_){}
}
window.__estudo={versao:VERSAO,pronto:false,vQuestoes,vCards,vAlvo,acao,modoCards,resumoCards,etapaCards,botaoQuiz,resultado,alvoDaUnidade,alvoChip,contar,
  abrirQuiz,abrirCards,filaCards,_proximo:proximo,_estado:()=>({BQ:!!BQ,bancoErro,ses})};
function esperar(n){if(window.__mx&&window.__mx.MJ)return iniciar();if(n>200)return;setTimeout(()=>esperar(n+1),100);}
esperar(0);
})();
