<script>/* Dashboard Destaksul — JavaScript totalmente offline, sem bibliotecas externas. */
(() => {
  'use strict';
  const META = DASHBOARD_DATA.metadata;
  const ROWS = DASHBOARD_DATA.rows;
  const DAY_ORDER = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
  const BAND_ORDER = ['00h–05h59','06h–08h59','09h–11h59','12h–14h59','15h–17h59','18h–20h59','21h–23h59'];
  const COLORS = ['#5741c7','#ff7900','#1fb86a','#ff6f7f','#4e8df7','#a168d5','#e9a227','#3ab3a5','#d84d5f','#7d879a','#8dbf42','#bd6a35'];
  const BRL = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const NUM = new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0});
  const NUM2 = new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const PCT = new Intl.NumberFormat('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
  const DATE_BR = new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC'});
  const formatValue = (formatter, value) => typeof formatter === 'function' ? formatter(value) : formatter.format(value);
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

  const unique = (arr) => [...new Set(arr)];
  const sum = (arr, fn=x=>x) => arr.reduce((a,x)=>a+(Number(fn(x))||0),0);
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const isoDate = (d) => d.toISOString().slice(0,10);
  const parseDate = (s) => new Date(`${s}T00:00:00Z`);
  const fmtDate = (s) => s ? DATE_BR.format(parseDate(s)) : '—';
  const daysInclusive = (a,b) => Math.max(1,Math.round((parseDate(b)-parseDate(a))/86400000)+1);
  const pct = (n,d) => d ? n/d*100 : 0;
  const safe = (n) => Number.isFinite(n) ? n : 0;
  const normalize = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const maskName = (name) => {
    const parts=String(name||'Não informado').trim().split(/\s+/);
    if(parts.length<=1) return parts[0];
    return `${parts[0]} ${parts.slice(1).map(p=>p[0]?.toUpperCase()+'.').join(' ')}`;
  };
  const download = (filename, content, mime='text/csv;charset=utf-8') => {
    const blob=new Blob([content],{type:mime}); const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},0);
  };
  const toCSV = (headers, rows) => {
    const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;
    return '\uFEFF'+[headers.map(q).join(';'),...rows.map(r=>r.map(q).join(';'))].join('\n');
  };
  const groupBy = (arr,keyFn) => {
    const m=new Map(); for(const x of arr){const k=keyFn(x); if(!m.has(k))m.set(k,[]);m.get(k).push(x);} return m;
  };
  const quantile = (values,q) => {
    const a=values.filter(Number.isFinite).sort((x,y)=>x-y); if(!a.length)return 0;
    const pos=(a.length-1)*q,base=Math.floor(pos),rest=pos-base;
    return a[base+1]!==undefined?a[base]+rest*(a[base+1]-a[base]):a[base];
  };
  const iconSvg = (name) => {
    const common='viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
    const paths={
      revenue:'<path d="M3 6h18v12H3z"/><path d="M7 10h.01M17 14h.01"/><circle cx="12" cy="12" r="2.4"/>',
      orders:'<path d="M6 3h12l2 4v14H4V7z"/><path d="M4 7h16M9 11h6"/>',
      products:'<path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"/><path d="M12 11v10"/>',
      ticket:'<path d="M4 7h16v10H4z"/><path d="M8 11h4M8 14h2M16 12h.01"/>',
      clients:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2-7 6-7s6 3 6 7"/><circle cx="17" cy="9" r="2"/><path d="M16 14c3 0 5 2 5 5"/>',
      new:'<circle cx="9" cy="9" r="4"/><path d="M2 21c0-5 3-8 7-8s7 3 7 8M18 7v6M15 10h6"/>',
      recurring:'<path d="M20 7h-5V2"/><path d="M20 7a8 8 0 1 0 1 8"/><path d="M4 17h5v5"/>',
      rate:'<path d="M5 19 19 5"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/>',
      daily:'<path d="M4 5h16v15H4zM8 3v4M16 3v4M4 9h16"/><path d="m8 15 2 2 5-5"/>',
      cancel:'<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>'
    };
    return `<svg ${common}>${paths[name]||paths.revenue}</svg>`;
  };

  const options = {
    channel: unique(ROWS.map(r=>r.channel)).sort(),
    origin: unique(ROWS.map(r=>r.origin)).sort(),
    status: unique(ROWS.map(r=>r.status)).sort(),
    uf: unique(ROWS.map(r=>r.uf)).sort(),
    category: unique(ROWS.map(r=>r.category)).sort(),
    gender: unique(ROWS.map(r=>r.gender)).sort(),
    paymentType: unique(ROWS.map(r=>r.paymentType)).sort()
  };

  const state = {
    dateStart:META.minDate,dateEnd:META.maxDate,
    selected:Object.fromEntries(Object.entries(options).map(([k,v])=>[k,new Set(v)])),
    productSearch:'',skuSearch:'',clientSearch:'',
    dailyMetric:'revenue',skuMetric:'qty',heatMetric:'orders',paretoDimension:'sku',paretoMetric:'revenue',abcClass:'ALL',
    genderMetric:'clients',paymentMetric:'orders',statusMetric:'orders',
    recordPage:1,recordPageSize:25,recordSort:{key:'datetime',dir:'desc'},recordSearch:''
  };

  const fullActiveOrders = aggregateOrders(ROWS.filter(r=>r.eligible));
  const fullFirstPurchase = new Map();
  for(const o of fullActiveOrders.values()){
    const old=fullFirstPurchase.get(o.client); if(!old||o.date<old) fullFirstPurchase.set(o.client,o.date);
  }

  function aggregateOrders(rows){
    const map=new Map();
    for(const r of rows){
      let o=map.get(r.order);
      if(!o){o={id:r.order,revenue:0,qty:0,date:r.date,datetime:r.datetime,client:r.client,origin:r.origin,channel:r.channel,payment:r.payment,paymentType:r.paymentType,gender:r.gender,uf:r.uf,status:r.status,statusGroup:r.statusGroup,products:new Set(),skus:new Set(),lines:0};map.set(r.order,o);}
      o.revenue+=r.revenue;o.qty+=r.qty;o.products.add(r.product);o.skus.add(r.sku);o.lines++;
      if(r.datetime<o.datetime){o.datetime=r.datetime;o.date=r.date;}
    }
    return map;
  }
  function filtersExceptDate(row){
    for(const k of Object.keys(options)) if(!state.selected[k].has(row[k])) return false;
    if(state.productSearch && !normalize(row.product).includes(normalize(state.productSearch))) return false;
    if(state.skuSearch && !normalize(row.sku).includes(normalize(state.skuSearch))) return false;
    if(state.clientSearch && !normalize(row.client).includes(normalize(state.clientSearch))) return false;
    return true;
  }
  function getFilteredRows(includeDate=true){
    return ROWS.filter(r=>{
      if(includeDate && (r.date<state.dateStart||r.date>state.dateEnd)) return false;
      return filtersExceptDate(r);
    });
  }
  function metricsForRows(rows){
    const eligible=rows.filter(r=>r.eligible), orders=aggregateOrders(eligible), allOrders=aggregateOrders(rows);
    const byClient=new Map();
    for(const o of orders.values()){if(!byClient.has(o.client))byClient.set(o.client,[]);byClient.get(o.client).push(o);}
    const clients=byClient.size;
    const recurring=[...byClient.values()].filter(v=>v.length>=2).length;
    const salesDays=unique(eligible.map(r=>r.date)).length;
    const calendarDays=daysInclusive(state.dateStart,state.dateEnd);
    const eligibleRevenue=sum(eligible,r=>r.revenue), gross=sum(rows,r=>r.revenue), quantity=sum(eligible,r=>r.qty);
    const cancelled=rows.filter(r=>r.statusGroup==='Cancelado'), pending=rows.filter(r=>r.statusGroup==='Pendente');
    const filteredClientNames=new Set([...orders.values()].map(o=>o.client));
    const newClients=[...filteredClientNames].filter(c=>{const d=fullFirstPurchase.get(c);return d&&d>=state.dateStart&&d<=state.dateEnd;}).length;
    return {rows,eligible,orders,allOrders,byClient,revenue:eligibleRevenue,gross,quantity,orderCount:orders.size,allOrderCount:allOrders.size,ticket:orders.size?eligibleRevenue/orders.size:0,clients,newClients,recurring,repurchase:clients?recurring/clients*100:0,salesDays,calendarDays,avgDailyCalendar:eligibleRevenue/calendarDays,avgDailySales:salesDays?eligibleRevenue/salesDays:0,avgOrdersCalendar:orders.size/calendarDays,cancelValue:sum(cancelled,r=>r.revenue),cancelOrders:aggregateOrders(cancelled).size,pendingValue:sum(pending,r=>r.revenue),pendingOrders:aggregateOrders(pending).size};
  }
  function previousMetrics(){
    const duration=daysInclusive(state.dateStart,state.dateEnd), prevEnd=new Date(parseDate(state.dateStart)-86400000), prevStart=new Date(prevEnd-(duration-1)*86400000);
    const ps=isoDate(prevStart),pe=isoDate(prevEnd);
    if(pe<META.minDate) return null;
    const rows=ROWS.filter(r=>r.date>=ps&&r.date<=pe&&filtersExceptDate(r));
    if(!rows.length) return null;
    const oldStart=state.dateStart,oldEnd=state.dateEnd; state.dateStart=ps;state.dateEnd=pe;
    const m=metricsForRows(rows); state.dateStart=oldStart;state.dateEnd=oldEnd;
    m.period=[ps,pe];return m;
  }

  function init(){
    $('#dateStart').min=META.minDate;$('#dateStart').max=META.maxDate;$('#dateStart').value=state.dateStart;
    $('#dateEnd').min=META.minDate;$('#dateEnd').max=META.maxDate;$('#dateEnd').value=state.dateEnd;
    $('#generatedAt').textContent=META.generatedAt;$('#sourceFile').textContent=META.sourceFile;
    $('#basePeriod').textContent=`${fmtDate(META.minDate)} a ${fmtDate(META.maxDate)}`;
    $('#baseRows').textContent=NUM.format(META.totalRows);$('#baseOrders').textContent=NUM.format(META.uniqueOrders);
    for(const [key,vals] of Object.entries(options)) buildMultiFilter(key,vals);
    bindEvents(); restoreGoals(); renderAll();
  }

  function buildMultiFilter(key,vals){
    const root=document.querySelector(`[data-filter="${key}"]`); if(!root)return;
    const labels={channel:'Canal',origin:'Origem',status:'Situação',uf:'UF',category:'Categoria',gender:'Gênero',paymentType:'Pagamento'};
    root.innerHTML=`<label class="field-label">${labels[key]}</label><div class="multi-filter" id="mf-${key}"><button class="multi-trigger" type="button"><span>${labels[key]}</span><b>${vals.length}/${vals.length}</b></button><div class="multi-panel"><input class="multi-search" placeholder="Pesquisar..."><div class="multi-actions"><button data-action="all">Selecionar tudo</button><button data-action="none">Limpar</button></div><div class="multi-options"></div></div></div>`;
    const mf=$('.multi-filter',root),panel=$('.multi-options',root),search=$('.multi-search',root);
    const draw=(term='')=>{panel.innerHTML=vals.filter(v=>normalize(v).includes(normalize(term))).map(v=>`<label class="multi-option"><input type="checkbox" value="${esc(v)}" ${state.selected[key].has(v)?'checked':''}><span>${esc(v)}</span></label>`).join('');};draw();
    $('.multi-trigger',root).addEventListener('click',e=>{e.stopPropagation();$$('.multi-filter.open').forEach(x=>x!==mf&&x.classList.remove('open'));mf.classList.toggle('open');});
    search.addEventListener('input',()=>draw(search.value));
    panel.addEventListener('change',e=>{if(e.target.matches('input[type=checkbox]')){e.target.checked?state.selected[key].add(e.target.value):state.selected[key].delete(e.target.value);updateMultiCount(key);renderAll();}});
    $('.multi-actions',root).addEventListener('click',e=>{const action=e.target.dataset.action;if(!action)return;e.preventDefault();state.selected[key]=new Set(action==='all'?vals:[]);draw(search.value);updateMultiCount(key);renderAll();});
  }
  function updateMultiCount(key){const mf=$(`#mf-${key}`), n=state.selected[key].size,total=options[key].length;$('b',mf).textContent=`${n}/${total}`;}
  function bindEvents(){
    document.addEventListener('click',()=>$$('.multi-filter.open').forEach(x=>x.classList.remove('open')));
    $$('.multi-panel').forEach(p=>p.addEventListener('click',e=>e.stopPropagation()));
    $('#dateStart').addEventListener('change',e=>{state.dateStart=e.target.value;if(state.dateStart>state.dateEnd){state.dateEnd=state.dateStart;$('#dateEnd').value=state.dateEnd;}state.recordPage=1;renderAll();});
    $('#dateEnd').addEventListener('change',e=>{state.dateEnd=e.target.value;if(state.dateEnd<state.dateStart){state.dateStart=state.dateEnd;$('#dateStart').value=state.dateStart;}state.recordPage=1;renderAll();});
    for(const id of ['productSearch','skuSearch','clientSearch']) $(`#${id}`).addEventListener('input',e=>{state[id]=e.target.value;state.recordPage=1;renderAll();});
    $('#clearFilters').addEventListener('click',resetFilters);
    $('#dailyMetric').addEventListener('change',e=>{state.dailyMetric=e.target.value;renderAll();});
    $('#skuMetric').addEventListener('change',e=>{state.skuMetric=e.target.value;renderAll();});
    $('#heatMetric').addEventListener('change',e=>{state.heatMetric=e.target.value;renderAll();});
    $('#paretoDimension').addEventListener('change',e=>{state.paretoDimension=e.target.value;renderAll();});
    $('#paretoMetric').addEventListener('change',e=>{state.paretoMetric=e.target.value;renderAll();});
    $('#abcClass').addEventListener('change',e=>{state.abcClass=e.target.value;renderAll();});
    $('#genderMetric').addEventListener('change',e=>{state.genderMetric=e.target.value;renderAll();});
    $('#paymentMetric').addEventListener('change',e=>{state.paymentMetric=e.target.value;renderAll();});
    $('#statusMetric').addEventListener('change',e=>{state.statusMetric=e.target.value;renderAll();});
    $('#recordSearch').addEventListener('input',e=>{state.recordSearch=e.target.value;state.recordPage=1;renderRecords(lastMetrics);});
    $('#recordPageSize').addEventListener('change',e=>{state.recordPageSize=Number(e.target.value);state.recordPage=1;renderRecords(lastMetrics);});
    $('#prevPage').addEventListener('click',()=>{state.recordPage=Math.max(1,state.recordPage-1);renderRecords(lastMetrics);});
    $('#nextPage').addEventListener('click',()=>{state.recordPage++;renderRecords(lastMetrics);});
    $('#printBtn').addEventListener('click',()=>window.print());$('#pdfBtn').addEventListener('click',()=>window.print());
    $('#exportFiltered').addEventListener('click',()=>exportFiltered(lastMetrics));
    $('#exportProducts').addEventListener('click',()=>exportProducts(lastMetrics));
    $('#exportClients').addEventListener('click',()=>exportClients(lastMetrics));
    $('#exportChannels').addEventListener('click',()=>exportChannels(lastMetrics));
    $('#exportUF').addEventListener('click',()=>exportUF(lastMetrics));
    $$('.goal-input').forEach(i=>i.addEventListener('input',()=>{saveGoals();renderGoals(lastMetrics);}));
    $('#goalEnd').addEventListener('change',()=>{saveGoals();renderGoals(lastMetrics);});
    $('.main').addEventListener('scroll',e=>$('#backTop').classList.toggle('show',e.target.scrollTop>500));
    $('#backTop').addEventListener('click',()=>$('.main').scrollTo({top:0,behavior:'smooth'}));
    document.addEventListener('click',e=>{const th=e.target.closest('#recordsTable th[data-key]');if(th){const key=th.dataset.key;if(state.recordSort.key===key)state.recordSort.dir=state.recordSort.dir==='asc'?'desc':'asc';else state.recordSort={key,dir:'asc'};renderRecords(lastMetrics);}});
  }
  function resetFilters(){
    state.dateStart=META.minDate;state.dateEnd=META.maxDate;$('#dateStart').value=state.dateStart;$('#dateEnd').value=state.dateEnd;
    for(const [k,v] of Object.entries(options)){state.selected[k]=new Set(v);updateMultiCount(k);const root=$(`[data-filter="${k}"]`);if(root){$$('input[type=checkbox]',root).forEach(x=>x.checked=true);}}
    for(const id of ['productSearch','skuSearch','clientSearch']){state[id]='';$(`#${id}`).value='';}
    state.recordPage=1;renderAll();
  }

  let lastMetrics=null;
  function renderAll(){
    const filtered=getFilteredRows(), m=metricsForRows(filtered);lastMetrics=m;
    renderActiveFilters(m);renderKPIs(m,previousMetrics());renderDaily(m);renderChannel(m);renderOriginTable(m);renderTime(m);renderHeatmap(m);renderProducts(m);renderPareto(m);renderCustomers(m);renderRFM(m);renderDonuts(m);renderUF(m);renderLosses(m);renderQuality(m);renderGoals(m);renderRecords(m);renderValidation(m);renderSummary(m);renderRail(m);
  }

  function renderActiveFilters(m){
    const chips=[];
    if(state.dateStart!==META.minDate||state.dateEnd!==META.maxDate) chips.push(`Período: ${fmtDate(state.dateStart)}–${fmtDate(state.dateEnd)}`);
    for(const [k,vals] of Object.entries(options)) if(state.selected[k].size!==vals.length) chips.push(`${{channel:'Canal',origin:'Origem',status:'Situação',uf:'UF',category:'Categoria',gender:'Gênero',paymentType:'Pagamento'}[k]}: ${state.selected[k].size} selecionado(s)`);
    if(state.productSearch)chips.push(`Produto: “${state.productSearch}”`);if(state.skuSearch)chips.push(`SKU: “${state.skuSearch}”`);if(state.clientSearch)chips.push(`Cliente: “${state.clientSearch}”`);
    $('#activeFilters').innerHTML=`<span class="active-filters-label">Filtros aplicados</span>${chips.length?chips.map((c,i)=>`<span class="filter-chip ${i%2?'orange':''}">${esc(c)}</span>`).join(''):'<span class="filter-chip">Visualizando todos os dados disponíveis.</span>'}<span class="filter-chip orange">${NUM.format(m.rows.length)} linhas · ${NUM.format(m.allOrderCount)} pedidos · ${PCT.format(pct(m.rows.length,META.totalRows))}% da base</span>`;
    $('#filteredPeriod').textContent=`${fmtDate(state.dateStart)} a ${fmtDate(state.dateEnd)}`;
  }

  function renderKPIs(m,prev){
    const defs=[
      ['Faturamento elegível',m.revenue,'revenue',BRL,'Soma da coluna Faturamento somente para situações ativas. Cancelados e pendentes aparecem separados.','--purple','#f0edff'],
      ['Pedidos únicos',m.orderCount,'orders',NUM,'Contagem distinta do Código Pedido nas situações elegíveis.','--orange','#fff1e4'],
      ['Produtos vendidos',m.quantity,'products',NUM,'Soma da coluna Quantidade nas linhas elegíveis.','--green','#eaf8f1'],
      ['Ticket médio',m.ticket,'ticket',BRL,'Faturamento elegível ÷ pedidos únicos.','--coral','#fff0f2'],
      ['Clientes únicos',m.clients,'clients',NUM,'Clientes distintos pelo nome disponível na base.','--blue','#edf4ff'],
      ['Clientes novos*',m.newClients,'new',NUM,'Primeira compra conhecida dentro do período selecionado; limitado ao histórico da planilha.','--purple','#f0edff'],
      ['Clientes recorrentes',m.recurring,'recurring',NUM,'Clientes com dois ou mais pedidos elegíveis no período filtrado.','--orange','#fff1e4'],
      ['Taxa de recompra',m.repurchase,'rate',v=>`${PCT.format(v)}%`,'Clientes com 2+ pedidos ÷ clientes únicos × 100.','--green','#eaf8f1'],
      ['Média diária',m.avgDailyCalendar,'daily',BRL,'Faturamento elegível ÷ dias corridos do período selecionado.','--blue','#edf4ff'],
      ['Valor cancelado',m.cancelValue,'cancel',BRL,'Soma do valor das linhas com situação cancelada; não integra o faturamento principal.','--coral','#fff0f2']
    ];
    const prevMap=prev?{0:prev.revenue,1:prev.orderCount,2:prev.quantity,3:prev.ticket,4:prev.clients,5:prev.newClients,6:prev.recurring,7:prev.repurchase,8:prev.avgDailyCalendar,9:prev.cancelValue}:{};
    $('#kpiGrid').innerHTML=defs.map((d,i)=>{
      const [label,value,icon,formatter,tip,accent,soft]=d, pv=prevMap[i], delta=prev&&pv!==undefined?value-pv:null,deltaPct=prev&&pv?delta/pv*100:null;
      const cls=delta===null?'neutral':delta>0?'up':delta<0?'down':'neutral';
      const deltaText=delta===null?'Sem histórico anterior':`${delta>=0?'▲':'▼'} ${PCT.format(Math.abs(deltaPct||0))}%`;
      const progress=i===0?clamp(value/(value+m.cancelValue+m.pendingValue||1)*100,0,100):clamp((i===7?value:value/(Math.max(value,pv||value)||1)*100),4,100);
      return `<article class="kpi-card tooltip" data-tip="${esc(tip)}" style="--accent:var(${accent});--soft:${soft};--glow:${soft}"><div class="kpi-top"><div class="kpi-icon">${iconSvg(icon)}</div><div class="kpi-label">${label}</div></div><div class="kpi-value">${formatValue(formatter,value)}</div><div class="kpi-foot"><span class="delta ${cls}">${deltaText}</span><span>${prev?`vs. ${fmtDate(prev.period[0])}–${fmtDate(prev.period[1])}`:'comparação indisponível'}</span></div><div class="spark"><span style="width:${progress}%"></span></div></article>`;
    }).join('');
  }

  function dailySeries(m,metric=state.dailyMetric){
    const days=[];for(let d=parseDate(state.dateStart);d<=parseDate(state.dateEnd);d=new Date(d.getTime()+86400000))days.push(isoDate(d));
    const by=groupBy(m.eligible,r=>r.date), out=[];
    for(const date of days){const rr=by.get(date)||[],orders=aggregateOrders(rr),clients=new Set([...orders.values()].map(o=>o.client));let value=0;
      if(metric==='revenue')value=sum(rr,r=>r.revenue);else if(metric==='orders')value=orders.size;else if(metric==='qty')value=sum(rr,r=>r.qty);else if(metric==='ticket')value=orders.size?sum(rr,r=>r.revenue)/orders.size:0;else if(metric==='clients')value=clients.size;
      out.push({label:date,value});
    }return out;
  }
  function renderDaily(m){
    const labels={revenue:'Faturamento',orders:'Pedidos',qty:'Produtos',ticket:'Ticket médio',clients:'Clientes'};
    $('#dailyTitle').textContent=`Evolução diária — ${labels[state.dailyMetric]}`;
    const data=dailySeries(m), formatter=['revenue','ticket'].includes(state.dailyMetric)?BRL:NUM;
    renderLineChart($('#dailyChart'),data,formatter,{average:true});
    const nonzero=data.filter(x=>x.value>0),best=nonzero.sort((a,b)=>b.value-a.value)[0],worst=[...nonzero].sort((a,b)=>a.value-b.value)[0];
    $('#dailyHighlights').innerHTML=`<div class="mini-stat"><span>Melhor dia</span><strong>${best?fmtDate(best.label):'—'}</strong><small>${best?formatValue(formatter,best.value):'Sem dados'}</small></div><div class="mini-stat"><span>Menor dia com venda</span><strong>${worst?fmtDate(worst.label):'—'}</strong><small>${worst?formatValue(formatter,worst.value):'Sem dados'}</small></div><div class="mini-stat"><span>Média por dia corrido</span><strong>${formatValue(formatter,data.length?sum(data,x=>x.value)/data.length:0)}</strong><small>${data.length} dias no intervalo</small></div><div class="mini-stat"><span>Dias com venda</span><strong>${NUM.format(nonzero.length)}</strong><small>${PCT.format(pct(nonzero.length,data.length))}% dos dias</small></div>`;
  }

  function renderLineChart(svg,data,formatter,opts={}){
    if(!data.length){svg.innerHTML='<text x="50%" y="50%" text-anchor="middle" fill="#9098a8">Não existem dados suficientes.</text>';return;}
    const W=760,H=280,p={l:52,r:18,t:18,b:42},cw=W-p.l-p.r,ch=H-p.t-p.b,max=Math.max(...data.map(d=>d.value),1),min=0,step=data.length>1?cw/(data.length-1):cw;
    const x=i=>p.l+i*step,y=v=>p.t+ch-(v-min)/(max-min||1)*ch;
    const points=data.map((d,i)=>`${x(i)},${y(d.value)}`).join(' '),area=`${p.l},${p.t+ch} ${points} ${x(data.length-1)},${p.t+ch}`;
    const avg=sum(data,d=>d.value)/data.length;
    let html=`<defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5741c7" stop-opacity=".20"/><stop offset="100%" stop-color="#5741c7" stop-opacity="0"/></linearGradient></defs>`;
    for(let i=0;i<=4;i++){const yy=p.t+ch*i/4,val=max*(1-i/4);html+=`<line x1="${p.l}" y1="${yy}" x2="${W-p.r}" y2="${yy}" stroke="#edf0f5"/><text x="${p.l-8}" y="${yy+3}" text-anchor="end" font-size="9" fill="#8b93a3">${esc(formatValue(formatter,val))}</text>`;}
    html+=`<polygon points="${area}" fill="url(#areaGrad)"/><polyline points="${points}" fill="none" stroke="#5741c7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    if(opts.average) html+=`<line x1="${p.l}" y1="${y(avg)}" x2="${W-p.r}" y2="${y(avg)}" stroke="#ff7900" stroke-width="1.5" stroke-dasharray="5 5"/><text x="${W-p.r-2}" y="${y(avg)-6}" text-anchor="end" font-size="9" fill="#cf6400">Média ${esc(formatValue(formatter,avg))}</text>`;
    const tickEvery=Math.max(1,Math.ceil(data.length/8));
    data.forEach((d,i)=>{if(i%tickEvery===0||i===data.length-1)html+=`<text x="${x(i)}" y="${H-18}" text-anchor="middle" font-size="9" fill="#8891a2">${fmtDate(d.label).slice(0,5)}</text>`;html+=`<circle cx="${x(i)}" cy="${y(d.value)}" r="3.2" fill="#fff" stroke="#5741c7" stroke-width="2"><title>${fmtDate(d.label)}: ${formatValue(formatter,d.value)}</title></circle>`;});
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.innerHTML=html;
  }

  function channelAgg(m,field='channel'){
    const groups=groupBy(m.eligible,r=>r[field]);const total=m.revenue,totalOrders=m.orderCount;
    return [...groups].map(([name,rows])=>{const orders=aggregateOrders(rows),clients=new Set([...orders.values()].map(o=>o.client));const rev=sum(rows,r=>r.revenue),qty=sum(rows,r=>r.qty),byClient=groupBy([...orders.values()],o=>o.client);return {name,revenue:rev,orders:orders.size,qty,clients:clients.size,ticket:orders.size?rev/orders.size:0,revenueShare:pct(rev,total),orderShare:pct(orders.size,totalOrders),repurchase:clients.size?[...byClient.values()].filter(v=>v.length>=2).length/clients.size*100:0};}).sort((a,b)=>b.revenue-a.revenue);
  }
  function renderChannel(m){const data=channelAgg(m,'channel');renderBarChart($('#channelChart'),data.map(x=>({label:x.name,value:x.revenue})),BRL,false);const top=data[0];$('#channelHeadline').innerHTML=top?`<strong>${esc(top.name)}</strong> lidera com ${BRL.format(top.revenue)} e ${PCT.format(top.revenueShare)}% do faturamento elegível.`:'Sem dados elegíveis.';}
  function renderOriginTable(m){
    const data=channelAgg(m,'origin');$('#originTable').innerHTML=tableHTML(['Origem','Faturamento','Pedidos','Produtos','Clientes','Ticket médio','% Fat.','% Ped.','Recompra'],data.map(x=>[x.name,BRL.format(x.revenue),NUM.format(x.orders),NUM.format(x.qty),NUM.format(x.clients),BRL.format(x.ticket),`${PCT.format(x.revenueShare)}%`,`${PCT.format(x.orderShare)}%`,`${PCT.format(x.repurchase)}%`]));
    const topOrders=[...data].sort((a,b)=>b.orders-a.orders)[0],topTicket=[...data].sort((a,b)=>b.ticket-a.ticket)[0];
    $('#originHighlights').innerHTML=`<div class="mini-stat"><span>Maior faturamento</span><strong>${esc(data[0]?.name||'—')}</strong><small>${data[0]?BRL.format(data[0].revenue):'—'}</small></div><div class="mini-stat"><span>Mais pedidos</span><strong>${esc(topOrders?.name||'—')}</strong><small>${topOrders?NUM.format(topOrders.orders):'—'}</small></div><div class="mini-stat"><span>Maior ticket</span><strong>${esc(topTicket?.name||'—')}</strong><small>${topTicket?BRL.format(topTicket.ticket):'—'}</small></div><div class="mini-stat"><span>Campo Loja</span><strong>Não disponível</strong><small>Origem preservada sem reinterpretação</small></div>`;
  }
  function renderBarChart(svg,data,formatter,horizontal=true){
    if(!data.length){svg.innerHTML='<text x="50%" y="50%" text-anchor="middle" fill="#9098a8">Não existem dados suficientes.</text>';return;}
    const W=680,H=horizontal?Math.max(230,data.length*30+35):270,p={l:horizontal?190:48,r:20,t:15,b:horizontal?25:52},cw=W-p.l-p.r,ch=H-p.t-p.b,max=Math.max(...data.map(d=>d.value),1);let html='';
    if(horizontal){const bh=Math.min(20,ch/data.length*.64),gap=ch/data.length;data.forEach((d,i)=>{const yy=p.t+i*gap+(gap-bh)/2,w=d.value/max*cw;html+=`<text x="${p.l-8}" y="${yy+bh/2+3}" text-anchor="end" font-size="9" fill="#596273">${esc(String(d.label).slice(0,34))}</text><rect x="${p.l}" y="${yy}" width="${cw}" height="${bh}" rx="6" fill="#f0f1f5"/><rect x="${p.l}" y="${yy}" width="${w}" height="${bh}" rx="6" fill="${COLORS[i%COLORS.length]}"><title>${esc(d.label)}: ${esc(formatValue(formatter,d.value))}</title></rect><text x="${Math.min(p.l+w+6,W-8)}" y="${yy+bh/2+3}" font-size="9" fill="#4c5566">${esc(formatValue(formatter,d.value))}</text>`;});}
    else{const gap=cw/data.length,bw=Math.min(58,gap*.58);for(let i=0;i<=4;i++){const yy=p.t+ch*i/4;html+=`<line x1="${p.l}" y1="${yy}" x2="${W-p.r}" y2="${yy}" stroke="#edf0f5"/>`;}
      data.forEach((d,i)=>{const h=d.value/max*ch,x=p.l+i*gap+(gap-bw)/2,y=p.t+ch-h;html+=`<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="8" fill="${COLORS[i%COLORS.length]}"><title>${esc(d.label)}: ${esc(formatValue(formatter,d.value))}</title></rect><text x="${x+bw/2}" y="${H-26}" text-anchor="middle" font-size="9" fill="#596273">${esc(String(d.label).replace('Marketplace','Mkt.').slice(0,16))}</text><text x="${x+bw/2}" y="${Math.max(12,y-6)}" text-anchor="middle" font-size="9" fill="#4c5566">${esc(formatValue(formatter,d.value))}</text>`;});}
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.innerHTML=html;
  }

  function renderTime(m){
    const byDate=groupBy(m.eligible,r=>r.date),dateStats=[...byDate].map(([date,rows])=>({date,revenue:sum(rows,r=>r.revenue),orders:aggregateOrders(rows).size,qty:sum(rows,r=>r.qty)}));
    const byWeek=groupBy(m.eligible,r=>r.weekday),weekStats=[...byWeek].map(([name,rows])=>({name,revenue:sum(rows,r=>r.revenue),orders:aggregateOrders(rows).size}));
    const byBand=groupBy(m.eligible,r=>r.timeBand),bandStats=[...byBand].map(([name,rows])=>({name,revenue:sum(rows,r=>r.revenue),orders:aggregateOrders(rows).size,qty:sum(rows,r=>r.qty)}));
    const max=(arr,key)=>[...arr].sort((a,b)=>b[key]-a[key])[0];
    const cards=[['Média por dia corrido',BRL.format(m.avgDailyCalendar),`${NUM.format(m.avgOrdersCalendar)} pedidos/dia`],['Dia de maior faturamento',fmtDate(max(dateStats,'revenue')?.date),max(dateStats,'revenue')?BRL.format(max(dateStats,'revenue').revenue):'—'],['Dia com mais pedidos',fmtDate(max(dateStats,'orders')?.date),max(dateStats,'orders')?`${NUM.format(max(dateStats,'orders').orders)} pedidos`:'—'],['Dia da semana líder',max(weekStats,'revenue')?.name||'—',max(weekStats,'revenue')?BRL.format(max(weekStats,'revenue').revenue):'—'],['Faixa com mais pedidos',max(bandStats,'orders')?.name||'—',max(bandStats,'orders')?`${NUM.format(max(bandStats,'orders').orders)} pedidos`:'—'],['Faixa com maior faturamento',max(bandStats,'revenue')?.name||'—',max(bandStats,'revenue')?BRL.format(max(bandStats,'revenue').revenue):'—']];
    $('#timeStats').innerHTML=cards.map(c=>`<div class="mini-stat"><span>${c[0]}</span><strong>${c[1]}</strong><small>${c[2]}</small></div>`).join('');
    renderBarChart($('#timeBandChart'),BAND_ORDER.map(name=>({label:name,value:(bandStats.find(x=>x.name===name)||{orders:0})[state.heatMetric==='revenue'?'revenue':state.heatMetric==='qty'?'qty':'orders']})),state.heatMetric==='revenue'?BRL:NUM,true);
  }
  function renderHeatmap(m){
    const metric=state.heatMetric, map=new Map();
    for(const day of DAY_ORDER)for(const band of BAND_ORDER)map.set(`${day}|${band}`,[]);
    for(const r of m.eligible)map.get(`${r.weekday}|${r.timeBand}`)?.push(r);
    const vals=[];for(const [k,rr] of map){let v=metric==='revenue'?sum(rr,r=>r.revenue):metric==='qty'?sum(rr,r=>r.qty):aggregateOrders(rr).size;vals.push(v);}const max=Math.max(...vals,1);
    let html='<div></div>'+DAY_ORDER.map(d=>`<div class="heatmap-label">${d.slice(0,3)}</div>`).join('');
    BAND_ORDER.forEach(b=>{html+=`<div class="heatmap-label heatmap-row-label">${b}</div>`;DAY_ORDER.forEach(d=>{const rr=map.get(`${d}|${b}`)||[],v=metric==='revenue'?sum(rr,r=>r.revenue):metric==='qty'?sum(rr,r=>r.qty):aggregateOrders(rr).size,t=v/max,alpha=.08+t*.78,label=metric==='revenue'?BRL.format(v):NUM.format(v);html+=`<div class="heat-cell" style="background:rgba(87,65,199,${alpha})" title="${d}, ${b}: ${label}">${v?metric==='revenue'?NUM.format(v):NUM.format(v):''}</div>`;});});
    $('#heatmap').innerHTML=html;
  }

  function productAgg(m){
    const orderMap=m.orders, groups=groupBy(m.eligible,r=>r.sku),totalQty=m.quantity,totalRev=m.revenue;
    return [...groups].map(([sku,rows])=>{const orderIds=new Set(rows.map(r=>r.order)),clients=new Set(rows.map(r=>r.client)),rev=sum(rows,r=>r.revenue),qty=sum(rows,r=>r.qty),ordersRevenue=sum([...orderIds],id=>orderMap.get(id)?.revenue||0);return {sku,product:rows[0].product,category:rows[0].category,qty,revenue:rev,orders:orderIds.size,clients:clients.size,orderTicket:orderIds.size?ordersRevenue/orderIds.size:0,qtyShare:pct(qty,totalQty),revenueShare:pct(rev,totalRev)};});
  }
  function renderProducts(m){
    const data=productAgg(m),key=state.skuMetric,sorted=[...data].sort((a,b)=>b[key]-a[key]);
    const fmt=key==='revenue'?BRL:NUM;renderBarChart($('#skuChart'),sorted.slice(0,10).map(x=>({label:`${x.sku} · ${x.product}`,value:x[key]})),fmt,true);
    $('#skuTable').innerHTML=tableHTML(['#','SKU','Produto','Categoria','Qtd.','Faturamento','Pedidos','Clientes','Ticket pedidos','% Qtd.','% Fat.'],sorted.slice(0,10).map((x,i)=>[`<span class="rank-pill">${i+1}</span>`,x.sku,x.product,x.category,NUM.format(x.qty),BRL.format(x.revenue),NUM.format(x.orders),NUM.format(x.clients),BRL.format(x.orderTicket),`${PCT.format(x.qtyShare)}%`,`${PCT.format(x.revenueShare)}%`]),true);
    const top=sorted[0];$('#skuHeadline').innerHTML=top?`<strong>${esc(top.sku)}</strong> — ${esc(top.product)} lidera por ${state.skuMetric==='revenue'?'faturamento':'volume'} com ${formatValue(fmt,top[key])}.`:'Sem dados elegíveis.';
  }

  function dimensionAgg(m,dimension,metric){
    const fields={sku:'sku',product:'product',client:'client',origin:'origin',channel:'channel',uf:'uf'},field=fields[dimension]||'sku',groups=groupBy(m.eligible,r=>r[field]);
    const out=[...groups].map(([name,rows])=>{let value=0;if(metric==='revenue')value=sum(rows,r=>r.revenue);else if(metric==='qty')value=sum(rows,r=>r.qty);else value=aggregateOrders(rows).size;return {name,value};}).sort((a,b)=>b.value-a.value);
    const total=sum(out,x=>x.value);let cumulative=0,thresholdCount=0;
    out.forEach(x=>{const prev=cumulative;cumulative+=x.value;x.share=pct(x.value,total);x.cum=total?cumulative/total*100:0;x.class=(x.cum<=80||prev/total*100<80)?'A':(x.cum<=95||prev/total*100<95)?'B':'C';if(x.cum<=80||prev/total*100<80)thresholdCount++;});
    return {items:out,total,thresholdCount,thresholdPct:pct(thresholdCount,out.length)};
  }
  function renderPareto(m){
    const p=dimensionAgg(m,state.paretoDimension,state.paretoMetric),fmt=state.paretoMetric==='revenue'?BRL:NUM;
    renderParetoChart($('#paretoChart'),p.items.slice(0,30),fmt);
    $('#paretoIndicator').innerHTML=p.items.length?`<strong>${NUM.format(p.thresholdCount)} de ${NUM.format(p.items.length)} elementos (${PCT.format(p.thresholdPct)}%)</strong> respondem por aproximadamente 80% do resultado selecionado.`:'Sem dados elegíveis.';
    const filtered=state.abcClass==='ALL'?p.items:p.items.filter(x=>x.class===state.abcClass);
    $('#abcTable').innerHTML=tableHTML(['Posição','Elemento','Resultado','Participação','Acumulado','Classe'],filtered.slice(0,50).map((x,i)=>[i+1,x.name,formatValue(fmt,x.value),`${PCT.format(x.share)}%`,`${PCT.format(x.cum)}%`,`<span class="abc-badge abc-${x.class.toLowerCase()}">${x.class}</span>`]),true);
    const counts=['A','B','C'].map(c=>({c,n:p.items.filter(x=>x.class===c).length,value:sum(p.items.filter(x=>x.class===c),x=>x.value)}));
    $('#abcStats').innerHTML=counts.map(x=>`<div class="mini-stat"><span>Classe ${x.c}</span><strong>${NUM.format(x.n)} itens</strong><small>${formatValue(fmt,x.value)} · ${PCT.format(pct(x.value,p.total))}%</small></div>`).join('');
  }
  function renderParetoChart(svg,data,formatter){
    if(!data.length){svg.innerHTML='<text x="50%" y="50%" text-anchor="middle" fill="#9098a8">Não existem dados suficientes.</text>';return;}
    const W=760,H=285,p={l:45,r:46,t:20,b:55},cw=W-p.l-p.r,ch=H-p.t-p.b,max=Math.max(...data.map(x=>x.value),1),gap=cw/data.length,bw=Math.max(3,gap*.65);let html='';
    for(let i=0;i<=4;i++){const yy=p.t+ch*i/4;html+=`<line x1="${p.l}" y1="${yy}" x2="${W-p.r}" y2="${yy}" stroke="#edf0f5"/><text x="${p.l-6}" y="${yy+3}" text-anchor="end" font-size="8" fill="#8b93a3">${esc(formatValue(formatter,max*(1-i/4)))}</text>`;}
    const pts=[];data.forEach((d,i)=>{const h=d.value/max*ch,x=p.l+i*gap+(gap-bw)/2,y=p.t+ch-h,cy=p.t+ch-(d.cum/100)*ch;pts.push(`${x+bw/2},${cy}`);html+=`<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="3" fill="${d.class==='A'?'#1fb86a':d.class==='B'?'#e9a227':'#7867df'}"><title>${esc(d.name)}: ${esc(formatValue(formatter,d.value))} · Acum. ${PCT.format(d.cum)}%</title></rect>`;if(i%Math.max(1,Math.ceil(data.length/10))===0)html+=`<text transform="translate(${x+bw/2},${H-18}) rotate(-38)" text-anchor="end" font-size="7" fill="#777f90">${esc(String(d.name).slice(0,16))}</text>`;});
    const y80=p.t+ch*.2;html+=`<line x1="${p.l}" y1="${y80}" x2="${W-p.r}" y2="${y80}" stroke="#ff7900" stroke-width="1.5" stroke-dasharray="5 5"/><text x="${W-p.r}" y="${y80-5}" text-anchor="end" font-size="9" fill="#c75f00">80%</text><polyline points="${pts.join(' ')}" fill="none" stroke="#5741c7" stroke-width="2.4"/>`;
    data.forEach((d,i)=>{const x=p.l+i*gap+gap/2,y=p.t+ch-(d.cum/100)*ch;html+=`<circle cx="${x}" cy="${y}" r="2.5" fill="#fff" stroke="#5741c7" stroke-width="1.5"/>`;});
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.innerHTML=html;
  }

  function customerAgg(m){
    const by=groupBy([...m.orders.values()],o=>o.client),end=parseDate(state.dateEnd);
    return [...by].map(([client,orders])=>{orders.sort((a,b)=>a.date.localeCompare(b.date));const dates=orders.map(o=>o.date),intervals=[];for(let i=1;i<dates.length;i++)intervals.push((parseDate(dates[i])-parseDate(dates[i-1]))/86400000);const revenue=sum(orders,o=>o.revenue),qty=sum(orders,o=>o.qty);return {client,masked:maskName(client),orders:orders.length,qty,revenue,ticket:revenue/orders.length,first:dates[0],last:dates[dates.length-1],daysSince:Math.max(0,(end-parseDate(dates[dates.length-1]))/86400000),interval:intervals.length?sum(intervals)/intervals.length:null};}).sort((a,b)=>b.orders-a.orders||b.revenue-a.revenue);
  }
  function renderCustomers(m){
    const data=customerAgg(m),rec=data.filter(x=>x.orders>=2),single=data.filter(x=>x.orders===1),recRev=sum(rec,x=>x.revenue);
    $('#customerStats').innerHTML=`<div class="mini-stat"><span>Clientes de compra única</span><strong>${NUM.format(single.length)}</strong><small>${PCT.format(pct(single.length,data.length))}% dos clientes</small></div><div class="mini-stat"><span>Clientes recorrentes</span><strong>${NUM.format(rec.length)}</strong><small>${PCT.format(m.repurchase)}% de recompra</small></div><div class="mini-stat"><span>Faturamento recorrentes</span><strong>${BRL.format(recRev)}</strong><small>${PCT.format(pct(recRev,m.revenue))}% do faturamento</small></div><div class="mini-stat"><span>Ticket recorrentes</span><strong>${BRL.format(rec.length?recRev/sum(rec,x=>x.orders):0)}</strong><small>por pedido recorrente</small></div>`;
    $('#customerTable').innerHTML=tableHTML(['#','Cliente','Pedidos','Produtos','Faturamento','Ticket','1ª compra','Última compra','Dias desde última','Intervalo médio'],rec.slice(0,30).map((x,i)=>[`<span class="rank-pill">${i+1}</span>`,x.masked,NUM.format(x.orders),NUM.format(x.qty),BRL.format(x.revenue),BRL.format(x.ticket),fmtDate(x.first),fmtDate(x.last),NUM.format(x.daysSince),x.interval===null?'—':`${NUM2.format(x.interval)} dias`]),true);
  }
  function rfmData(m){
    const clients=customerAgg(m),m80=quantile(clients.map(x=>x.revenue),.8),m50=quantile(clients.map(x=>x.revenue),.5);
    for(const c of clients){let segment;if(c.daysSince>21)segment='Perdidos';else if(c.orders>=3&&c.revenue>=m80)segment='Fiéis';else if(c.revenue>=m80&&c.orders>=2)segment='Alto valor';else if(c.orders>=3)segment='Frequentes';else if(c.orders===2&&c.daysSince<=7)segment='Em crescimento';else if(c.orders===1&&c.daysSince<=7)segment='Novos';else if(c.orders>=2&&c.daysSince>14)segment='Em risco';else if(c.orders===1&&c.daysSince>14)segment='Inativos';else segment=c.revenue>=m50?'Potenciais':'Recentes';c.segment=segment;}return clients;
  }
  function renderRFM(m){
    const data=rfmData(m),groups=groupBy(data,x=>x.segment),summary=[...groups].map(([segment,rows])=>({segment,clients:rows.length,revenue:sum(rows,x=>x.revenue),ticket:sum(rows,x=>x.orders)?sum(rows,x=>x.revenue)/sum(rows,x=>x.orders):0,freq:rows.length?sum(rows,x=>x.orders)/rows.length:0,recency:rows.length?sum(rows,x=>x.daysSince)/rows.length:0})).sort((a,b)=>b.revenue-a.revenue);
    $('#rfmTable').innerHTML=tableHTML(['Segmento','Clientes','Faturamento','Ticket médio','Frequência média','Recência média','% Faturamento'],summary.map(x=>[x.segment,NUM.format(x.clients),BRL.format(x.revenue),BRL.format(x.ticket),NUM2.format(x.freq),`${NUM2.format(x.recency)} dias`,`${PCT.format(pct(x.revenue,m.revenue))}%`]));
    renderBarChart($('#rfmChart'),summary.map(x=>({label:x.segment,value:x.revenue})),BRL,true);
  }

  function donutData(m,field,metric){
    const base=field==='status'?m.rows:m.eligible,groups=groupBy(base,r=>r[field]);
    return [...groups].map(([name,rows])=>{let value=0;if(metric==='revenue')value=field==='status'?sum(rows,r=>r.revenue):sum(rows,r=>r.revenue);else if(metric==='qty')value=sum(rows,r=>r.qty);else if(metric==='clients')value=new Set(rows.map(r=>r.client)).size;else value=aggregateOrders(rows).size;return {name,value};}).sort((a,b)=>b.value-a.value);
  }
  function renderDonuts(m){renderDonut($('#genderDonut'),$('#genderLegend'),donutData(m,'gender',state.genderMetric),state.genderMetric==='revenue'?BRL:NUM);renderDonut($('#paymentDonut'),$('#paymentLegend'),donutData(m,'paymentType',state.paymentMetric),state.paymentMetric==='revenue'?BRL:NUM);renderDonut($('#statusDonut'),$('#statusLegend'),donutData(m,'status',state.statusMetric),state.statusMetric==='revenue'?BRL:NUM);}
  function renderDonut(donut,legend,data,formatter){
    const total=sum(data,x=>x.value);if(!data.length||!total){donut.style.background='#eef0f4';donut.innerHTML='<div class="donut-center"><strong>0</strong><span>sem dados</span></div>';legend.innerHTML='';return;}
    let acc=0,parts=[];data.forEach((x,i)=>{const start=acc,share=x.value/total*100;acc+=share;parts.push(`${COLORS[i%COLORS.length]} ${start}% ${acc}%`);});donut.style.background=`conic-gradient(${parts.join(',')})`;donut.innerHTML=`<div class="donut-center"><strong>${formatValue(formatter,total)}</strong><span>total</span></div>`;
    legend.innerHTML=data.slice(0,12).map((x,i)=>`<div class="legend-item"><span class="legend-dot" style="background:${COLORS[i%COLORS.length]}"></span><span title="${esc(x.name)}">${esc(String(x.name).slice(0,29))}</span><b>${PCT.format(pct(x.value,total))}%</b></div>`).join('');
  }

  const UF_POS={AC:[70,210],RO:[125,205],AM:[145,120],RR:[183,55],AP:[320,64],PA:[282,130],TO:[306,198],MA:[372,155],PI:[406,187],CE:[458,192],RN:[492,202],PB:[486,222],PE:[462,240],AL:[465,260],SE:[449,274],BA:[392,270],MT:[226,224],GO:[307,264],DF:[329,252],MS:[238,305],MG:[354,324],ES:[421,330],RJ:[392,360],SP:[317,361],PR:[291,401],SC:[307,432],RS:[272,472]};
  function ufAgg(m){const groups=groupBy(m.eligible,r=>r.uf),total=m.revenue;return [...groups].map(([uf,rows])=>{const orders=aggregateOrders(rows),clients=new Set([...orders.values()].map(o=>o.client)),byC=groupBy([...orders.values()],o=>o.client),rev=sum(rows,r=>r.revenue);return {uf,revenue:rev,orders:orders.size,qty:sum(rows,r=>r.qty),clients:clients.size,ticket:orders.size?rev/orders.size:0,revenueShare:pct(rev,total),orderShare:pct(orders.size,m.orderCount),repurchase:clients.size?[...byC.values()].filter(v=>v.length>=2).length/clients.size*100:0};}).sort((a,b)=>b.revenue-a.revenue);}
  function renderUF(m){
    const data=ufAgg(m),max=Math.max(...data.map(x=>x.revenue),1),lookup=new Map(data.map(x=>[x.uf,x]));let html='<path d="M65 190 L90 120 L135 75 L205 36 L278 50 L336 72 L394 128 L485 177 L505 235 L470 285 L425 337 L395 380 L335 438 L287 503 L245 466 L220 395 L188 340 L145 285 L100 258 Z" fill="#f5f6fa" stroke="#e1e4ea" stroke-width="2"/>';
    for(const [uf,[x,y]] of Object.entries(UF_POS)){const d=lookup.get(uf),t=d?d.revenue/max:0,fill=d?`rgba(87,65,199,${.15+.8*t})`:'#eceef3',r=10+8*Math.sqrt(t);html+=`<circle class="map-state" cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="#fff" stroke-width="1.5"><title>${uf}: ${d?BRL.format(d.revenue):'Sem vendas'} · ${d?NUM.format(d.orders):0} pedidos</title></circle><text class="map-label" x="${x}" y="${y+3}">${uf}</text>`;}
    $('#ufMap').setAttribute('viewBox','45 25 480 500');$('#ufMap').innerHTML=html;
    $('#ufTable').innerHTML=tableHTML(['#','UF','Faturamento','Pedidos','Produtos','Clientes','Ticket','% Fat.','% Ped.','Recompra'],data.map((x,i)=>[i+1,x.uf,BRL.format(x.revenue),NUM.format(x.orders),NUM.format(x.qty),NUM.format(x.clients),BRL.format(x.ticket),`${PCT.format(x.revenueShare)}%`,`${PCT.format(x.orderShare)}%`,`${PCT.format(x.repurchase)}%`]));
    const topOrders=[...data].sort((a,b)=>b.orders-a.orders)[0],topTicket=[...data].sort((a,b)=>b.ticket-a.ticket)[0];$('#ufHighlights').innerHTML=`<div class="mini-stat"><span>Maior faturamento</span><strong>${data[0]?.uf||'—'}</strong><small>${data[0]?BRL.format(data[0].revenue):'—'}</small></div><div class="mini-stat"><span>Mais pedidos</span><strong>${topOrders?.uf||'—'}</strong><small>${topOrders?NUM.format(topOrders.orders):'—'}</small></div><div class="mini-stat"><span>Maior ticket</span><strong>${topTicket?.uf||'—'}</strong><small>${topTicket?BRL.format(topTicket.ticket):'—'}</small></div><div class="mini-stat"><span>UFs atendidas</span><strong>${NUM.format(data.length)}</strong><small>de 27 UFs brasileiras</small></div>`;
  }

  function renderLosses(m){
    const cancelRows=m.rows.filter(r=>r.statusGroup==='Cancelado'),pendingRows=m.rows.filter(r=>r.statusGroup==='Pendente'),cancelOrders=aggregateOrders(cancelRows),pendingOrders=aggregateOrders(pendingRows),gross=m.gross;
    const cards=[['Pedidos cancelados',m.cancelOrders,`${PCT.format(pct(m.cancelOrders,m.allOrderCount))}% dos pedidos criados`],['Valor cancelado',BRL.format(m.cancelValue),`${PCT.format(pct(m.cancelValue,gross))}% do valor bruto`],['Pedidos pendentes',m.pendingOrders,`${PCT.format(pct(m.pendingOrders,m.allOrderCount))}% dos pedidos`],['Valor pendente',BRL.format(m.pendingValue),`${PCT.format(pct(m.pendingValue,gross))}% do valor bruto`],['Devoluções',0,'Nenhuma situação de devolução encontrada'],['Reembolsos',0,'Nenhuma situação de reembolso encontrada']];
    $('#lossStats').innerHTML=cards.map(c=>`<div class="mini-stat"><span>${c[0]}</span><strong>${typeof c[1]==='number'?NUM.format(c[1]):c[1]}</strong><small>${c[2]}</small></div>`).join('');
    const bySku=groupBy(cancelRows,r=>r.sku),affected=[...bySku].map(([sku,rows])=>({sku,product:rows[0].product,value:sum(rows,r=>r.revenue),orders:aggregateOrders(rows).size})).sort((a,b)=>b.value-a.value).slice(0,10);
    $('#lossTable').innerHTML=tableHTML(['SKU','Produto','Pedidos cancelados','Valor envolvido'],affected.map(x=>[x.sku,x.product,NUM.format(x.orders),BRL.format(x.value)]));
    const daily=groupBy(cancelRows,r=>r.date),series=[];for(let d=parseDate(state.dateStart);d<=parseDate(state.dateEnd);d=new Date(d.getTime()+86400000)){const date=isoDate(d),rr=daily.get(date)||[];series.push({label:date,value:sum(rr,r=>r.revenue)});}renderLineChart($('#cancelChart'),series,BRL,{average:false});
  }

  function renderQuality(m){
    const q=META.quality, missingTotal=sum(Object.values(q.missing)),keyCells=META.totalRows*13,completeness=(1-missingTotal/keyCells)*100,status=q.invalidDates===0&&q.invalidUFs===0&&q.lineCountMismatches===0&&completeness>=98?'Excelente':completeness>=90?'Boa':'Regular';
    const items=[['Linhas importadas',META.totalRows],['Pedidos únicos',META.uniqueOrders],['Campos vazios',missingTotal],['Datas inválidas',q.invalidDates],['UFs inválidas',q.invalidUFs],['Linhas repetidas legítimas',q.exactRepeatedLines],['Divergências de linhas/pedido',q.lineCountMismatches],['Completude',`${PCT.format(completeness)}%`]];
    $('#qualityGrid').innerHTML=items.map(x=>`<div class="quality-item"><span>${x[0]}</span><strong>${typeof x[1]==='number'?NUM.format(x[1]):x[1]}</strong></div>`).join('');
    $('#qualityStatus').innerHTML=`<span class="status-dot ${status==='Excelente'?'status-ok':'status-warn'}"></span>Qualidade geral: <strong>${status}</strong>`;
    $('#qualityNote').textContent=q.treatmentNote;
    $('#limitations').innerHTML=META.limitations.map(x=>`<div class="validation-line"><span class="status-dot status-warn"></span><span>${esc(x)}</span></div>`).join('');
  }

  function goals(){return {revenue:Number($('#goalRevenue').value)||0,orders:Number($('#goalOrders').value)||0,ticket:Number($('#goalTicket').value)||0,qty:Number($('#goalQty').value)||0,newClients:Number($('#goalNew').value)||0,end:$('#goalEnd').value||META.maxDate};}
  function saveGoals(){try{localStorage.setItem('destaksulGoals',JSON.stringify(goals()));}catch(_){/* armazenamento local pode estar bloqueado em arquivos locais */}}
  function restoreGoals(){let stored=null;try{stored=localStorage.getItem('destaksulGoals');}catch(_){stored=null;}let d=null;try{d=JSON.parse(stored||'null');}catch(_){d=null;}d=d||{revenue:100000,orders:1100,ticket:95,qty:3500,newClients:1000,end:'2026-07-31'};$('#goalRevenue').value=d.revenue;$('#goalOrders').value=d.orders;$('#goalTicket').value=d.ticket;$('#goalQty').value=d.qty;$('#goalNew').value=d.newClients;$('#goalEnd').value=d.end;}
  function renderGoals(m){
    if(!m)return;const g=goals(),defs=[['Faturamento',m.revenue,g.revenue,BRL],['Pedidos',m.orderCount,g.orders,NUM],['Ticket médio',m.ticket,g.ticket,BRL],['Produtos',m.quantity,g.qty,NUM],['Novos clientes*',m.newClients,g.newClients,NUM]];
    $('#goalResults').innerHTML=defs.map(([label,actual,target,fmt])=>{const progress=target?pct(actual,target):0;return `<div class="goal-card"><label>${label}</label><div class="goal-result"><strong>${formatValue(fmt,actual)}</strong><span>${target?`${PCT.format(progress)}%`:'sem meta'}</span></div><div class="progress-bar"><span style="width:${clamp(progress,0,100)}%"></span></div><small>${target?`Meta ${formatValue(fmt,target)} · faltam ${formatValue(fmt,Math.max(0,target-actual))}`:'Defina uma meta na lateral do card.'}</small></div>`;}).join('');
    const elapsed=daysInclusive(state.dateStart,state.dateEnd),goalDays=Math.max(elapsed,daysInclusive(state.dateStart,g.end)),remaining=Math.max(0,goalDays-elapsed),projection=m.avgDailyCalendar*goalDays,dailyNeed=remaining&&g.revenue>m.revenue?(g.revenue-m.revenue)/remaining:0;
    $('#projectionText').innerHTML=`Projeção matemática até <strong>${fmtDate(g.end)}</strong>: <strong>${BRL.format(projection)}</strong>. Dias considerados: ${goalDays}; dias restantes: ${remaining}; média diária necessária para a meta de faturamento: <strong>${BRL.format(dailyNeed)}</strong>. A projeção é indicativa e não garante o resultado.`;
  }

  function renderRecords(m){
    if(!m)return;let rows=m.rows.filter(r=>!state.recordSearch||normalize([r.order,r.sku,r.product,r.client,r.origin,r.uf,r.status].join(' ')).includes(normalize(state.recordSearch)));
    const {key,dir}=state.recordSort;rows=[...rows].sort((a,b)=>{let av=a[key],bv=b[key];if(typeof av==='number'&&typeof bv==='number')return dir==='asc'?av-bv:bv-av;return dir==='asc'?String(av).localeCompare(String(bv),'pt-BR'):String(bv).localeCompare(String(av),'pt-BR');});
    const pages=Math.max(1,Math.ceil(rows.length/state.recordPageSize));state.recordPage=clamp(state.recordPage,1,pages);const start=(state.recordPage-1)*state.recordPageSize,view=rows.slice(start,start+state.recordPageSize);
    $('#recordsTable').innerHTML=`<table class="data-table"><thead><tr>${[['order','Pedido'],['datetime','Data/Hora'],['client','Cliente'],['origin','Origem'],['sku','SKU'],['product','Produto'],['category','Categoria'],['qty','Qtd.'],['revenue','Faturamento linha'],['paymentType','Pagamento'],['uf','UF'],['status','Situação']].map(([k,l])=>`<th data-key="${k}">${l}${state.recordSort.key===k?(state.recordSort.dir==='asc'?' ↑':' ↓'):''}</th>`).join('')}</tr></thead><tbody>${view.map(r=>`<tr><td>${esc(r.order)}</td><td>${fmtDate(r.date)} ${esc(r.time.slice(0,5))}</td><td>${esc(maskName(r.client))}</td><td>${esc(r.origin)}</td><td>${esc(r.sku)}</td><td title="${esc(r.product)}">${esc(r.product.slice(0,55))}</td><td>${esc(r.category)}</td><td>${NUM.format(r.qty)}</td><td>${BRL.format(r.revenue)}</td><td>${esc(r.paymentType)}</td><td>${esc(r.uf)}</td><td>${esc(r.status)}</td></tr>`).join('')}</tbody></table>`;
    $('#pageInfo').textContent=`Página ${state.recordPage} de ${pages} · ${NUM.format(rows.length)} linhas`;
    $('#prevPage').disabled=state.recordPage<=1;$('#nextPage').disabled=state.recordPage>=pages;
    $('#recordTotals').textContent=`Faturamento elegível: ${BRL.format(m.revenue)} · Quantidade: ${NUM.format(m.quantity)} · Pedidos: ${NUM.format(m.orderCount)}`;
  }

  function validationChecks(m){
    const origin=sum(channelAgg(m,'origin'),x=>x.revenue),channel=sum(channelAgg(m,'channel'),x=>x.revenue),products=sum(productAgg(m),x=>x.qty),productRev=sum(productAgg(m),x=>x.revenue),statusOrders=sum([...groupBy(m.rows,r=>r.status)].map(([,rr])=>aggregateOrders(rr).size));
    const pareto=dimensionAgg(m,'sku','revenue');
    return [
      ['Faturamento por origem corresponde ao total',Math.abs(origin-m.revenue)<.02],
      ['Faturamento por canal corresponde ao total',Math.abs(channel-m.revenue)<.02],
      ['Quantidade por SKU corresponde ao total vendido',Math.abs(products-m.quantity)<.001],
      ['Faturamento dos SKUs corresponde ao detalhado',Math.abs(productRev-m.revenue)<.02],
      ['Pedidos por situação fecham com o total criado',statusOrders===m.allOrderCount],
      ['Linhas por pedido validadas na importação',META.quality.lineCountMismatches===0],
      ['Pareto termina em 100%',!pareto.items.length||Math.abs(pareto.items.at(-1).cum-100)<.01],
      ['Valores numéricos sem NaN/undefined',[m.revenue,m.orderCount,m.quantity,m.ticket].every(Number.isFinite)]
    ];
  }
  function renderValidation(m){const checks=validationChecks(m),ok=checks.every(x=>x[1]);$('#validationHeadline').innerHTML=`<span class="status-dot ${ok?'status-ok':'status-warn'}"></span><strong>${ok?'Validação concluída sem divergências':'Divergências encontradas'}</strong>`;$('#validationList').innerHTML=checks.map(([name,pass])=>`<div class="validation-line"><span class="status-dot ${pass?'status-ok':'status-warn'}"></span><span>${esc(name)}</span></div>`).join('');}

  function summaryInsights(m){
    const origin=channelAgg(m,'origin'),channel=channelAgg(m,'channel'),products=productAgg(m).sort((a,b)=>b.qty-a.qty),byDate=dailySeries(m,'revenue').sort((a,b)=>b.value-a.value),bands=[...groupBy(m.eligible,r=>r.timeBand)].map(([name,rr])=>({name,orders:aggregateOrders(rr).size,revenue:sum(rr,r=>r.revenue)})).sort((a,b)=>b.orders-a.orders),ufs=ufAgg(m),payments=donutData(m,'paymentType','orders'),statuses=donutData(m,'status','orders'),pareto=dimensionAgg(m,'sku','revenue'),gender=donutData(m,'gender','clients'),rec=customerAgg(m).filter(x=>x.orders>=2),recRev=sum(rec,x=>x.revenue),cancelRate=pct(m.cancelOrders,m.allOrderCount);
    const arr=[];
    if(m.orderCount)arr.push(`O período filtrado gerou ${BRL.format(m.revenue)} em faturamento elegível, distribuído em ${NUM.format(m.orderCount)} pedidos e ${NUM.format(m.quantity)} produtos.`);
    if(origin[0])arr.push(`${origin[0].name} é a principal origem, com ${BRL.format(origin[0].revenue)} e ${PCT.format(origin[0].revenueShare)}% do faturamento.`);
    if(channel[0])arr.push(`O canal ${channel[0].name} concentra ${PCT.format(channel[0].revenueShare)}% do faturamento e ${PCT.format(channel[0].orderShare)}% dos pedidos.`);
    if(products[0])arr.push(`O SKU ${products[0].sku} — ${products[0].product} — lidera em volume com ${NUM.format(products[0].qty)} unidades.`);
    if(byDate[0]?.value)arr.push(`${fmtDate(byDate[0].label)} foi o melhor dia de faturamento, com ${BRL.format(byDate[0].value)}.`);
    if(bands[0])arr.push(`A faixa ${bands[0].name} concentra o maior número de pedidos: ${NUM.format(bands[0].orders)}.`);
    arr.push(`A taxa de recompra no período é ${PCT.format(m.repurchase)}%, com ${NUM.format(m.recurring)} clientes recorrentes entre ${NUM.format(m.clients)} clientes únicos.`);
    if(rec.length)arr.push(`Clientes recorrentes respondem por ${PCT.format(pct(recRev,m.revenue))}% do faturamento elegível.`);
    if(pareto.items.length)arr.push(`${NUM.format(pareto.thresholdCount)} de ${NUM.format(pareto.items.length)} SKUs (${PCT.format(pareto.thresholdPct)}%) são necessários para alcançar aproximadamente 80% do faturamento.`);
    if(ufs[0])arr.push(`${ufs[0].uf} lidera geograficamente com ${BRL.format(ufs[0].revenue)} e ${PCT.format(ufs[0].revenueShare)}% do faturamento.`);
    if(payments[0])arr.push(`${payments[0].name} é a forma de pagamento mais frequente, presente em ${PCT.format(pct(payments[0].value,sum(payments,x=>x.value)))}% dos pedidos elegíveis.`);
    if(statuses[0])arr.push(`${statuses[0].name} é a situação predominante, representando ${PCT.format(pct(statuses[0].value,sum(statuses,x=>x.value)))}% dos pedidos filtrados.`);
    arr.push(`Cancelamentos representam ${PCT.format(cancelRate)}% dos pedidos criados e envolvem ${BRL.format(m.cancelValue)}.`);
    if(gender[0])arr.push(`${gender[0].name} concentra ${PCT.format(pct(gender[0].value,sum(gender,x=>x.value)))}% dos clientes identificados na base.`);
    if(m.repurchase<10)arr.push(`Oportunidade principal: elevar retenção e segunda compra, pois a recompra está abaixo de 10% no histórico filtrado.`);else arr.push(`Oportunidade principal: ampliar a contribuição dos clientes recorrentes com campanhas por frequência e recência.`);
    if(origin[0]&&origin[0].revenueShare>60)arr.push(`Risco de concentração: uma única origem responde por mais de 60% do faturamento.`);else if(cancelRate>5)arr.push(`Risco principal: a taxa de cancelamento supera 5% dos pedidos criados.`);else arr.push(`Risco analítico: a ausência de custos impede medir margem e rentabilidade por canal e produto.`);
    return arr.slice(0,15);
  }
  function renderSummary(m){$('#summaryList').innerHTML=summaryInsights(m).map((x,i)=>`<div class="insight-item"><span class="insight-index">${i+1}</span><span>${esc(x)}</span></div>`).join('');}
  function renderRail(m){
    const p=dimensionAgg(m,'sku','revenue'),cancelRate=pct(m.cancelOrders,m.allOrderCount),score=clamp(100-(cancelRate*4)-Math.max(0,10-m.repurchase)*1.5,15,98),needle=-90+score*1.8;
    $('#railRevenue').textContent=BRL.format(m.revenue);$('#railOrders').textContent=NUM.format(m.orderCount);$('#railClients').textContent=NUM.format(m.clients);$('#gaugeValue').textContent=`${PCT.format(score)}%`;$('#gaugeArc').style.setProperty('--gauge',`${score/2}%`);$('#gaugeArc').style.setProperty('--needle',`${needle}deg`);
    const summary=summaryInsights(m).slice(0,3);$('#railInsights').innerHTML=summary.map((x,i)=>`<div class="rail-action"><div class="rail-action-left"><span class="rail-action-icon">${i+1}</span><span>${esc(x.slice(0,74))}${x.length>74?'…':''}</span></div></div>`).join('');
    const ok=validationChecks(m).every(x=>x[1]);$('#railValidation').innerHTML=`<span class="status-dot ${ok?'status-ok':'status-warn'}"></span>${ok?'Dados conciliados':'Revisar divergências'}`;
  }

  function tableHTML(headers,rows,raw=false){return `<table class="data-table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(v=>`<td>${raw?v:esc(v)}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}">Não existem dados suficientes para esta análise.</td></tr>`}</tbody></table>`;}

  function exportFiltered(m){const headers=['Pedido','Data','Hora','Cliente','Origem','Canal','SKU','Produto','Categoria','Quantidade','Faturamento Linha','Pagamento','UF','Situação'];const rows=m.rows.map(r=>[r.order,fmtDate(r.date),r.time,maskName(r.client),r.origin,r.channel,r.sku,r.product,r.category,r.qty,NUM2.format(r.revenue),r.payment,r.uf,r.status]);download('dados_filtrados_destaksul.csv',toCSV(headers,rows));}
  function exportProducts(m){const data=productAgg(m).sort((a,b)=>b.qty-a.qty),headers=['SKU','Produto','Categoria','Quantidade','Faturamento','Pedidos','Clientes','Ticket pedidos','% Quantidade','% Faturamento'];download('ranking_produtos_destaksul.csv',toCSV(headers,data.map(x=>[x.sku,x.product,x.category,x.qty,NUM2.format(x.revenue),x.orders,x.clients,NUM2.format(x.orderTicket),NUM2.format(x.qtyShare),NUM2.format(x.revenueShare)])));}
  function exportClients(m){const data=customerAgg(m),headers=['Cliente mascarado','Pedidos','Produtos','Faturamento','Ticket','Primeira compra','Última compra','Dias desde última','Intervalo médio'];download('ranking_clientes_destaksul.csv',toCSV(headers,data.map(x=>[x.masked,x.orders,x.qty,NUM2.format(x.revenue),NUM2.format(x.ticket),fmtDate(x.first),fmtDate(x.last),x.daysSince,x.interval===null?'':NUM2.format(x.interval)])));}
  function exportChannels(m){const data=channelAgg(m,'origin'),headers=['Origem','Faturamento','Pedidos','Produtos','Clientes','Ticket','% Faturamento','% Pedidos','Recompra'];download('analise_origem_destaksul.csv',toCSV(headers,data.map(x=>[x.name,NUM2.format(x.revenue),x.orders,x.qty,x.clients,NUM2.format(x.ticket),NUM2.format(x.revenueShare),NUM2.format(x.orderShare),NUM2.format(x.repurchase)])));}
  function exportUF(m){const data=ufAgg(m),headers=['UF','Faturamento','Pedidos','Produtos','Clientes','Ticket','% Faturamento','% Pedidos','Recompra'];download('analise_uf_destaksul.csv',toCSV(headers,data.map(x=>[x.uf,NUM2.format(x.revenue),x.orders,x.qty,x.clients,NUM2.format(x.ticket),NUM2.format(x.revenueShare),NUM2.format(x.orderShare),NUM2.format(x.repurchase)])));}

  function showFatalError(error){console.error('Falha ao inicializar o dashboard:',error);const target=document.querySelector('#kpiGrid')||document.body;target.innerHTML=`<div class="error-state" style="grid-column:1/-1;padding:18px;border:1px solid #ffd0d0;background:#fff5f5;border-radius:14px;color:#8a1f1f"><strong>Não foi possível carregar o dashboard.</strong><br><span>${esc(error?.message||error)}</span></div>`;}
  document.addEventListener('DOMContentLoaded',()=>{try{init();}catch(error){showFatalError(error);}});
})();
</script>
</body>
</html>
