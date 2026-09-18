const $ = id => document.getElementById(id);

const bind = (id, valId, fmt) => {
  const el = $(id), out = $(valId);
  const update = () => out.textContent = fmt(el.value);
  el.addEventListener('input', update);
  update();
};
bind('age','ageVal', v => v + ' yrs');
bind('founders','foundersVal', v => v);
bind('exp','expVal', v => v + ' yrs');
bind('unique','uniqueVal', v => v + ' / 9');
bind('retention','retentionVal', v => v + '%');

function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function fmtUSD(n){
  const sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n >= 1e6) return sign + '$' + (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return sign + '$' + (n/1e3).toFixed(0) + 'K';
  return sign + '$' + n.toFixed(0);
}

// Ranges observed in data/raw/startup_failure_prediction.csv (5,000 rows) — used for
// benchmarking and to flag inputs that fall outside the estimator's calibration range.
const DATASET = {
  age:        { min:0,     max:14,       mean:7.0 },
  funding:    { min:11209, max:49993132, mean:24973410 },
  founders:   { min:1,     max:4,        mean:2.5 },
  exp:        { min:0,     max:29,       mean:14.7 },
  employees:  { min:1,     max:999,      mean:496.7 },
  revenue:    { min:3213,  max:99996630, mean:49920150 },
  burn:       { min:5016,  max:999554,   mean:500960 },
  unique:     { min:1,     max:9,        mean:4.96 },
  retention:  { min:0.04,  max:99.98,    mean:50.2 },
  marketing:  { min:5253,  max:999866,   mean:507304 },
};

const FACTOR_INFO = {
  'Runway':             'Months of cash left at the current burn rate. Under ~12 months is the classic danger zone for the next fundraise.',
  'Burn multiple':       'Annual burn divided by annual revenue. Above 2-3x is generally seen as inefficient spend relative to growth.',
  'Retention':           'Share of customers who stick around. Low retention undermines every other growth metric.',
  'Founder experience':  'Average relevant experience across founders. Not a hard rule, but inexperience raises execution risk.',
  'Product uniqueness':  'Self/expert-rated differentiation, 1-9. Commoditized products face tighter margins and more competition.',
  'Revenue / employee':  'Revenue divided by headcount, a rough efficiency signal. Low values can mean overstaffing or weak monetization.',
  'Market efficiency':   'Revenue generated per dollar of marketing spend over the year. Low values suggest paid growth is not paying for itself.',
};

/*
  estimateRisk(input) -> { score, factors, runwayMonths, confidence, flags }
  Transparent, hand-weighted heuristic standing in for the trained model in
  models/startup_risk_model.pkl. Reads the same feature set as
  data/raw/startup_failure_prediction.csv.

  API CONTRACT for later swap-in:
    POST /predict { startup_age, funding_amount, number_of_founders, founder_experience,
                     employees_count, revenue, burn_rate, market_size, business_model,
                     product_uniqueness_score, customer_retention_rate, marketing_expense, industry }
    -> { risk_score: 0-100, factors: [{name, contribution, value}], runway_months, confidence }
*/
function estimateRisk(input){
  const runwayMonths = input.burn > 0 ? input.funding / input.burn : 99;
  const burnMultiple = input.revenue > 0 ? (input.burn*12) / input.revenue : 8;
  const revenuePerEmployee = input.revenue / Math.max(input.employees,1);
  const marketingEfficiency = input.marketing > 0 ? input.revenue / (input.marketing*12) : 1;

  const factors = [
    { name:'Runway',             risk: clamp(1 - runwayMonths/24, 0, 1), detail: runwayMonths.toFixed(1)+' mo left' },
    { name:'Burn multiple',      risk: clamp(burnMultiple/10, 0, 1),     detail: burnMultiple.toFixed(1)+'x revenue' },
    { name:'Retention',          risk: clamp(1 - input.retention/100,0,1), detail: input.retention+'%' },
    { name:'Founder experience', risk: clamp(1 - input.exp/20, 0, 1),    detail: input.exp+' yrs avg' },
    { name:'Product uniqueness', risk: clamp(1 - input.unique/9, 0, 1),  detail: input.unique+'/9' },
    { name:'Revenue / employee', risk: clamp(1 - revenuePerEmployee/50000,0,1), detail: fmtUSD(revenuePerEmployee) },
    { name:'Market efficiency',  risk: clamp(1 - marketingEfficiency/3,0,1), detail: marketingEfficiency.toFixed(2)+'x return' },
  ];
  const weights = [0.24, 0.18, 0.16, 0.12, 0.1, 0.1, 0.1];
  factors.forEach((f,i) => f.weight = weights[i]);

  let score = factors.reduce((sum,f) => sum + f.risk*f.weight, 0);
  score = clamp(score, 0, 1);
  if (input.age <= 1) score = clamp(score - 0.03, 0, 1); // young-startup grace factor

  // --- reliability / confidence -------------------------------------------------
  const checks = [
    { key:'age', label:'Startup age', v:input.age },
    { key:'funding', label:'Funding raised', v:input.funding },
    { key:'founders', label:'Founders', v:input.founders },
    { key:'exp', label:'Founder experience', v:input.exp },
    { key:'employees', label:'Employees', v:input.employees },
    { key:'revenue', label:'Revenue', v:input.revenue },
    { key:'burn', label:'Burn rate', v:input.burn },
    { key:'unique', label:'Product uniqueness', v:input.unique },
    { key:'retention', label:'Retention', v:input.retention },
    { key:'marketing', label:'Marketing spend', v:input.marketing },
  ];
  const flags = [];
  let outOfRange = 0;
  checks.forEach(c => {
    const range = DATASET[c.key];
    if (c.v < range.min || c.v > range.max){
      outOfRange++;
      flags.push({ ok:false, text:`${c.label} (${typeof c.v === 'number' && c.v > 1000 ? fmtUSD(c.v) : c.v}) is outside the ${c.key==='retention'||c.key==='unique'?'':'$'}${range.min}–${range.max} range seen in training data — treat this reading with extra caution.` });
    }
  });
  if (input.burn === 0) flags.push({ ok:false, text:'Burn rate is $0 — runway cannot be meaningfully estimated.' });
  if (flags.length === 0) flags.push({ ok:true, text:'All inputs fall within the ranges observed in the training dataset.' });

  const confidence = clamp(96 - outOfRange*11 - (input.burn===0?15:0), 35, 96);

  return { score: Math.round(score*100), factors, runwayMonths, burnMultiple, revenuePerEmployee, marketingEfficiency, confidence, flags };
}

function colorFor(risk){
  if (risk < 0.34) return getComputedStyle(document.documentElement).getPropertyValue('--mint').trim();
  if (risk < 0.62) return getComputedStyle(document.documentElement).getPropertyValue('--amber').trim();
  return getComputedStyle(document.documentElement).getPropertyValue('--red').trim();
}

function drawWave(svg, riskPct){
  const amp = 6 + riskPct*0.28;
  const spikes = riskPct > 60;
  let d = 'M0,40 ';
  const points = 40;
  for(let i=1;i<=points;i++){
    const x = i*(600/points);
    let y = spikes && i % 6 === 0 ? 40 - amp*2*(i%12===0?1:-1) : 40 + Math.sin(i*0.9)*amp*0.55;
    d += `L${x.toFixed(1)},${y.toFixed(1)} `;
  }
  svg.innerHTML = `<path d="${d}" fill="none" stroke="${colorFor(riskPct/100)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
}

function drawGauge(svg, scorePct){
  const c = colorFor(scorePct/100);
  const r = 80, cx = 100, cy = 100;
  const startAngle = Math.PI, endAngle = 0; // semicircle top
  const angle = Math.PI - (scorePct/100)*Math.PI;
  const arcPoint = (a) => [cx + r*Math.cos(a), cy - r*Math.sin(a)];
  const [x1,y1] = arcPoint(startAngle);
  const [x2,y2] = arcPoint(0);
  const [xn,yn] = arcPoint(angle);
  const largeArc = angle < Math.PI/2 ? 1 : 0;
  svg.innerHTML = `
    <path d="M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}" fill="none" stroke="#E1EAE7" stroke-width="14" stroke-linecap="round"/>
    <path d="M${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${xn},${yn}" fill="none" stroke="${c}" stroke-width="14" stroke-linecap="round"/>
  `;
}

function renderVital(f){
  const pct = Math.round(f.risk*100);
  const c = colorFor(f.risk);
  return `<div class="vital" data-name="${f.name}">
    <div class="vital-top">
      <span class="vital-name">${f.name} ⌄</span>
      <span class="vital-value" style="color:${c}">${f.detail}</span>
    </div>
    <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${c};"></div></div>
    <div class="vital-explain">${FACTOR_INFO[f.name]} Weighted at ${(f.weight*100).toFixed(0)}% of the total score.</div>
  </div>`;
}

let contribChart, radarChart, runwayChart, benchmarkChart;

function upsertChart(existing, ctx, config){
  if (existing){ existing.data = config.data; existing.options = config.options; existing.update(); return existing; }
  return new Chart(ctx, config);
}

$('runBtn').addEventListener('click', () => {
  const input = {
    age: +$('age').value, founders: +$('founders').value, exp: +$('exp').value,
    employees: +$('employees').value, funding: +$('funding').value, revenue: +$('revenue').value,
    burn: +$('burn').value, market: +$('market').value, marketing: +$('marketing').value,
    unique: +$('unique').value, retention: +$('retention').value,
    industry: $('industry').value, model: $('model').value,
  };

  const { score, factors, runwayMonths, burnMultiple, revenuePerEmployee, marketingEfficiency, confidence, flags } = estimateRisk(input);
  const c = colorFor(score/100);
  const label = score < 34 ? 'Stable' : score < 62 ? 'Elevated' : 'Critical';

  $('emptyState').style.display = 'none';
  $('results').style.display = 'block';
  $('chartPanels').style.display = 'block';

  $('scoreNum').textContent = score;
  $('scoreNum').style.color = c;
  const labelEl = $('scoreLabel');
  labelEl.textContent = label + ' risk';
  labelEl.style.color = c; labelEl.style.borderColor = c;
  $('confBadge').textContent = `confidence ${confidence}%`;

  drawGauge($('gauge'), score);
  drawWave($('wave'), score);
  $('waveCaption').textContent = `pulse — ${label.toLowerCase()} signal · runway ${runwayMonths.toFixed(1)} mo`;

  $('vitalsList').innerHTML = factors.map(renderVital).join('');
  document.querySelectorAll('.vital .vital-name').forEach(el => {
    el.addEventListener('click', () => el.closest('.vital').classList.toggle('open'));
  });

  // --- contribution (waterfall-style) chart --------------------------------
  const sorted = [...factors].sort((a,b) => (b.risk*b.weight) - (a.risk*a.weight));
  contribChart = upsertChart(contribChart, $('contribChart'), {
    type: 'bar',
    data: {
      labels: sorted.map(f => f.name),
      datasets: [{
        data: sorted.map(f => +(f.risk*f.weight*100).toFixed(1)),
        backgroundColor: sorted.map(f => colorFor(f.risk)),
        borderRadius: 4,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend:{display:false}, tooltip:{ callbacks:{ label: (ctx) => `contributes ${ctx.parsed.x} pts to the score` } } },
      scales: {
        x: { title:{display:true,text:'points contributed to final score',font:{size:11}}, grid:{color:'#EEF3F1'} },
        y: { grid:{display:false} }
      }
    }
  });

  // --- radar (health, higher = better) --------------------------------------
  radarChart = upsertChart(radarChart, $('radarChart'), {
    type: 'radar',
    data: {
      labels: factors.map(f => f.name),
      datasets: [{
        label: input.name || 'Startup',
        data: factors.map(f => Math.round((1-f.risk)*100)),
        backgroundColor: 'rgba(15,156,143,0.15)',
        borderColor: '#0F9C8F', pointBackgroundColor:'#0F9C8F', borderWidth:2,
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      scales: { r: { min:0, max:100, ticks:{stepSize:25, backdropColor:'transparent', color:'#93A69F'}, grid:{color:'#E1EAE7'}, angleLines:{color:'#E1EAE7'}, pointLabels:{font:{size:10.5}, color:'#5C726C'} } },
      plugins: { legend:{display:false} }
    }
  });

  // --- cash runway projection ------------------------------------------------
  const months = Array.from({length:25}, (_,i) => i);
  let cash = input.funding, monthlyRevenue = input.revenue/12;
  const cashSeries = months.map(m => {
    if (m > 0){ cash += monthlyRevenue - input.burn; monthlyRevenue *= 1.02; }
    return Math.round(cash);
  });
  const zeroMonth = cashSeries.findIndex(v => v <= 0);
  runwayChart = upsertChart(runwayChart, $('runwayChart'), {
    type: 'line',
    data: {
      labels: months.map(m => 'M'+m),
      datasets: [{
        data: cashSeries, borderColor:'#0F9C8F', backgroundColor:'rgba(15,156,143,0.08)',
        fill:true, tension:0.3, pointRadius:0, borderWidth:2,
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins: {
        legend:{display:false},
        tooltip:{ callbacks:{ label: (ctx) => fmtUSD(ctx.parsed.y) + ' cash on hand' } },
        annotation: undefined,
      },
      scales: {
        y: { ticks:{ callback: v => fmtUSD(v) }, grid:{color:'#EEF3F1'} },
        x: { grid:{display:false}, ticks:{maxTicksLimit:9} }
      }
    }
  });

  // --- benchmark vs dataset mean ---------------------------------------------
  const bench = [
    { label:'Funding', v: input.funding, mean: DATASET.funding.mean },
    { label:'Revenue', v: input.revenue, mean: DATASET.revenue.mean },
    { label:'Burn rate', v: input.burn, mean: DATASET.burn.mean },
    { label:'Marketing', v: input.marketing, mean: DATASET.marketing.mean },
    { label:'Retention', v: input.retention, mean: DATASET.retention.mean },
    { label:'Employees', v: input.employees, mean: DATASET.employees.mean },
  ];
  benchmarkChart = upsertChart(benchmarkChart, $('benchmarkChart'), {
    type: 'bar',
    data: {
      labels: bench.map(b => b.label),
      datasets: [
        { label: input.name || 'Startup', data: bench.map(b => +((b.v/b.mean)*100).toFixed(0)), backgroundColor:'#0F9C8F', borderRadius:4 },
        { label: 'Dataset average', data: bench.map(() => 100), backgroundColor:'#E1EAE7', borderRadius:4 },
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins: { legend:{position:'bottom', labels:{boxWidth:10,font:{size:11}}}, tooltip:{ callbacks:{ label: (ctx) => ctx.dataset.label + ': ' + ctx.parsed.y + '% of dataset average' } } },
      scales: { y:{ title:{display:true,text:'% of dataset average',font:{size:11}}, grid:{color:'#EEF3F1'} }, x:{ grid:{display:false} } }
    }
  });

  // --- reliability flags ---------------------------------------------------
  $('flagsList').innerHTML = flags.map(f => `<div class="flag ${f.ok?'ok':'warn'}"><span class="flag-dot"></span><span>${f.text}</span></div>`).join('');

  // --- verdict ---------------------------------------------------------------
  const name = $('name').value || 'This startup';
  const topRisk = [...factors].sort((a,b)=>b.risk-a.risk)[0];
  const runwayNote = zeroMonth === -1 ? 'holds a positive cash balance through the full 24-month projection' : `runs out of cash in month ${zeroMonth} of the projection`;
  $('verdict').innerHTML = `<b>${name}</b> scores <b>${score}/100</b> (${label.toLowerCase()} risk), estimated with <b>${confidence}% confidence</b>.
    The largest contributor is <b>${topRisk.name.toLowerCase()}</b> (${topRisk.detail}).
    At current burn and a modest 2%/month revenue growth assumption, the projection ${runwayNote}.
    This is a transparent heuristic, not the trained model — wire up <code>/predict</code> from <b>api/main.py</b> to replace it once the FastAPI backend exists.`;
});

$('runBtn').click();