/* =========================================================
   حاسبة الطاقة الشمسية الذكية
   تصميم وتطوير المهندس أبو كرمان
   نسخة الهاتف PWA — الإصدار المحسن
   ========================================================= */

const $ = id => document.getElementById(id);
const num = id => {
  const el = $(id);
  const v = Number(el?.value);
  return Number.isFinite(v) ? v : 0;
};
const fmt = (v, d=1) => Number(v || 0).toLocaleString('ar-EG', {maximumFractionDigits:d});
const clamp = (v,min,max) => Math.min(max, Math.max(min,v));

// تحديث موحد لصناديق الحالة والتنبيهات
function setStatus(id, message, warning=false){
  const el=$(id);
  if(!el)return;
  el.innerHTML=message || '';
  el.classList.toggle('warning', !!warning);
  el.classList.toggle('success', !warning && !!message);
}

const PANEL_PRESETS = [
  {id:'150', power:150, vmp:18.0, voc:22.1, imp:8.33, isc:8.84, label:'150W — Vmp 18.0V / Voc 22.1V / Imp 8.33A / Isc 8.84A'},
  {id:'250', power:250, vmp:30.5, voc:37.5, imp:8.20, isc:8.80, label:'250W — Vmp 30.5V / Voc 37.5V / Imp 8.20A / Isc 8.80A'},
  {id:'500', power:500, vmp:38.4, voc:45.6, imp:13.02, isc:13.75, label:'500W — Vmp 38.4V / Voc 45.6V / Imp 13.02A / Isc 13.75A'},
  {id:'680', power:680, vmp:39.1, voc:46.8, imp:17.39, isc:18.42, label:'680W — Vmp 39.1V / Voc 46.8V / Imp 17.39A / Isc 18.42A'},
  {id:'700', power:700, vmp:41.0, voc:49.0, imp:17.10, isc:18.00, label:'700W — Vmp 41.0V / Voc 49.0V / Imp 17.10A / Isc 18.00A'}
];

function syncPanelPresets(preserveId=''){
  const select=$('panelPreset');
  if(!select)return;
  const wanted=preserveId || select.value || '700';
  select.innerHTML=PANEL_PRESETS.map(x=>`<option value="${x.id}">${x.label}</option>`).join('') + '<option value="manual">إدخال يدوي — أدخل بيانات اللوح بنفسك</option>';
  select.value=PANEL_PRESETS.some(x=>x.id===wanted)?wanted:'manual';
  if(select.value!=='manual') applyPanelPreset(PANEL_PRESETS.find(x=>x.id===select.value));
}

function applyPanelPreset(preset){
  if(!preset)return;
  $('panelPower').value=preset.power;
  $('panelVmp').value=preset.vmp;
  $('panelVoc').value=preset.voc;
  $('panelImp').value=preset.imp;
  $('panelIsc').value=preset.isc;
}

function selectedPanelPreset(){
  const id=$('panelPreset')?.value;
  return PANEL_PRESETS.find(x=>x.id===id) || null;
}

const BATTERY_PRESETS = {
  12: [
    {id:'12-100', v:12, ah:100, label:'12V 100Ah — ≈1.2 kWh'},
    {id:'12-200', v:12, ah:200, label:'12V 200Ah — ≈2.4 kWh'}
  ],
  24: [
    {id:'24-100', v:24, ah:100, label:'24V 100Ah — ≈2.5 kWh (2.4 kWh اسمي)'},
    {id:'24-200', v:24, ah:200, label:'24V 200Ah — ≈5 kWh (4.8 kWh اسمي)'}
  ],
  48: [
    {id:'48-50', v:48, ah:50, label:'48V 50Ah — ≈2.5 kWh (2.4 kWh اسمي)'},
    {id:'48-100', v:48, ah:100, label:'48V 100Ah — ≈5 kWh (4.8 kWh اسمي)'}
  ]
};

function syncBatteryPresets(preserveId=''){
  const select=$('batteryPreset');
  if(!select)return;
  const systemV=Number($('systemVoltage')?.value)||24;
  const options=BATTERY_PRESETS[systemV] || BATTERY_PRESETS[24];
  const wanted=preserveId || select.value;
  select.innerHTML=options.map(x=>`<option value="${x.id}">${x.label}</option>`).join('');
  const found=options.find(x=>x.id===wanted) || options[0];
  select.value=found.id;
  applyBatteryPreset(found);
}

function applyBatteryPreset(preset){
  if(!preset)return;
  $('batteryVoltage').value=preset.v;
  $('batteryAh').value=preset.ah;
  if($('batteryNominalKwh'))$('batteryNominalKwh').value=`${fmt(preset.v*preset.ah/1000,1)} kWh`;
}

function selectedBatteryPreset(){
  const id=$('batteryPreset')?.value;
  return Object.values(BATTERY_PRESETS).flat().find(x=>x.id===id) || BATTERY_PRESETS[Number($('systemVoltage')?.value)||24][0];
}

const defaultLoads = [
  {name:'لمبة LED',power:30,count:1,duty:100,day:4,night:0},
  {name:'مروحة',power:120,count:1,duty:100,day:2,night:4},
  {name:'ثلاجة',power:300,count:1,duty:60,day:6,night:6},
  {name:'تلفاز',power:100,count:1,duty:100,day:4,night:0},
  {name:'كمبيوتر محمول',power:65,count:1,duty:100,day:2,night:0}
];

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":'&#039;'}[m]));
}

function addLoad(data={}){
  const x=Object.assign({name:'حمل جديد',power:100,count:1,duty:100,day:2,night:0},data);
  const tr=document.createElement('tr');
  tr.innerHTML=`
    <td><input class="load-name" value="${escapeHtml(x.name)}"></td>
    <td><input class="load-power" type="number" value="${x.power}" min="0" step="1"></td>
    <td><input class="load-count" type="number" value="${x.count}" min="1" step="1"></td>
    <td><input class="load-duty" type="number" value="${x.duty}" min="0" max="100" step="1"></td>
    <td><input class="load-day" type="number" value="${x.day}" min="0" max="24" step="0.5"></td>
    <td><input class="load-night" type="number" value="${x.night}" min="0" max="24" step="0.5"></td>
    <td class="load-energy">0</td>
    <td><button class="delete-btn" type="button">حذف</button></td>`;
  $('loadsBody').appendChild(tr);
  tr.querySelector('.delete-btn').addEventListener('click',()=>{tr.remove();calculateAll();});
  tr.querySelectorAll('input').forEach(i=>i.addEventListener('input',calculateAll));
}

function getLoads(){
  return [...document.querySelectorAll('#loadsBody tr')].map(tr=>{
    const q=s=>tr.querySelector(s);
    const power=Math.max(0,Number(q('.load-power').value)||0);
    const count=Math.max(0,Number(q('.load-count').value)||0);
    const duty=clamp(Number(q('.load-duty').value)||0,0,100);
    const day=clamp(Number(q('.load-day').value)||0,0,24);
    const night=clamp(Number(q('.load-night').value)||0,0,24);
    const energy=power*count*(duty/100)*(day+night);
    q('.load-energy').textContent=fmt(Math.round(energy),0);
    return {name:q('.load-name').value,power,count,duty,day,night,energy};
  });
}
function dailyTotal(){return getLoads().reduce((sum,x)=>sum+x.energy,0)}
// الحمل اللحظي للقواطع والإنفرتر لا يستخدم Duty؛ لأن القاطع يحمي من التيار الفعلي أثناء تشغيل الجهاز.
function peakLoad(){return getLoads().reduce((sum,x)=>sum+x.power*x.count,0)}

function mpptLimits(){
  const cMin=num('mpptMinVmp'),cMax=num('mpptMaxVmp'),cVoc=num('mpptMaxVoc'),cCur=num('controllerCurrent'),cPv=num('controllerMaxPvPower');
  return {minVmp:cMin,maxVmp:cMax,maxVoc:cVoc,maxCurrent:cCur,maxPvPower:cPv};
}
function inverterLimits(){
  return {
    minVmp:num('inverterMpptMin'),
    maxVmp:num('inverterMpptMax'),
    maxVoc:num('inverterMaxVoltage'),
    maxCurrent:num('inverterPvCurrent'),
    maxPvPower:num('inverterMaxPvPower')
  };
}

function activeMpptLimits(){
  const inv=inverterLimits(), ctl=mpptLimits();
  const useInverter=inv.maxVmp>0 && inv.maxVoc>0 && inv.maxCurrent>0;
  return {limits:useInverter?inv:ctl, source:useInverter?'الإنفرتر MPPT':'منظم MPPT', useInverter};
}

/*
  الاختيار التلقائي:
  1) يحسب عدد الألواح المطلوب.
  2) يبحث عن عدد ألواح التوالي S داخل نطاق Vmp وVoc.
  3) لكل S يحسب أقل توازي P يحقق العدد المطلوب.
  4) يرفض فورًا أي تركيبة تتجاوز Vmp أو Voc أو Imp أو قدرة PV القصوى.
  5) إذا لم يمكن الوصول للعدد المطلوب، يعرض أكبر مصفوفة آمنة بدل اختيار
     تركيبة تتجاوز حدود MPPT.
*/
function mpptCandidate(s,p,lim,panelW,vmp,voc,imp,isc,source){
  if(!s||!p)return null;
  const av=vmp*s, ao=voc*s, ai=imp*p, aisc=isc*p, power=panelW*s*p;
  const powerOk=!lim.maxPvPower || power<=lim.maxPvPower;
  if(av<(lim.minVmp||0) || av>(lim.maxVmp||Infinity))return null;
  if(ao>(lim.maxVoc||Infinity))return null;
  if(ai>(lim.maxCurrent||Infinity))return null;
  if(!powerOk)return null;
  return {s,p,count:s*p,power,vmp:av,voc:ao,imp:ai,isc:aisc,source};
}

function chooseAutomaticConnection(requiredPanels){
  const panelW=num('panelPower'),vmp=num('panelVmp'),voc=num('panelVoc'),imp=num('panelImp'),isc=num('panelIsc');
  const controller=mpptLimits(), inverter=inverterLimits();
  const target=Math.max(1,Math.ceil(requiredPanels||1));
  if(!panelW||!vmp||!voc||!imp||!isc)return null;

  const useInverterMppt=inverter.maxVmp>0 && inverter.maxVoc>0 && inverter.maxCurrent>0;
  const lim=useInverterMppt ? inverter : controller;
  const source=useInverterMppt ? 'الإنفرتر MPPT' : 'منظم MPPT';
  if(!lim.maxVmp||!lim.maxVoc||!lim.maxCurrent)return null;

  const maxSeries=Math.floor(Math.min(lim.maxVmp/vmp,lim.maxVoc/voc));
  const minSeries=Math.max(1,Math.ceil((lim.minVmp||0)/vmp));
  const maxParallel=Math.max(0,Math.floor(lim.maxCurrent/imp));
  if(maxSeries<minSeries||maxParallel<1)return null;

  const center=((lim.minVmp||0)+lim.maxVmp)/2;
  const candidates=[];

  // نبدأ بالتوالي: كل S يمثل جهد سلسلة صالح، ثم نحسب P المطلوب للعدد المستهدف.
  for(let s=minSeries;s<=maxSeries;s++){
    const p=Math.max(1,Math.ceil(target/s));
    if(p>maxParallel)continue;
    const c=mpptCandidate(s,p,lim,panelW,vmp,voc,imp,isc,source);
    if(!c)continue;
    candidates.push({
      ...c,
      extra:c.count-target,
      voltageDistance:center?Math.abs(c.vmp-center)/center:0
    });
  }

  // الأفضلية: أقل زيادة في العدد، ثم أقل توازي، ثم أقرب جهد للمنتصف، ثم S أكبر.
  candidates.sort((a,b)=>a.extra-b.extra||a.p-b.p||a.voltageDistance-b.voltageDistance||b.s-a.s);
  return candidates[0]||null;
}

function chooseMaximumSafeConnection(){
  const panelW=num('panelPower'),vmp=num('panelVmp'),voc=num('panelVoc'),imp=num('panelImp'),isc=num('panelIsc');
  const inverter=inverterLimits(), controller=mpptLimits();
  if(!panelW||!vmp||!voc||!imp||!isc)return null;
  const useInverterMppt=inverter.maxVmp>0&&inverter.maxVoc>0&&inverter.maxCurrent>0;
  const lim=useInverterMppt?inverter:controller;
  const source=useInverterMppt?'الإنفرتر MPPT':'منظم MPPT';
  if(!lim.maxVmp||!lim.maxVoc||!lim.maxCurrent)return null;

  const maxSeries=Math.floor(Math.min(lim.maxVmp/vmp,lim.maxVoc/voc));
  const minSeries=Math.max(1,Math.ceil((lim.minVmp||0)/vmp));
  const maxParallel=Math.max(0,Math.floor(lim.maxCurrent/imp));
  if(maxSeries<minSeries||maxParallel<1)return null;

  const candidates=[];
  for(let s=minSeries;s<=maxSeries;s++){
    for(let p=1;p<=maxParallel;p++){
      const c=mpptCandidate(s,p,lim,panelW,vmp,voc,imp,isc,source);
      if(c)candidates.push(c);
    }
  }
  // عند عدم إمكانية الوصول للعدد المطلوب، نختار أكبر قدرة آمنة دون تجاوز أي حد.
  candidates.sort((a,b)=>b.count-a.count||b.power-a.power||b.s-a.s||a.p-b.p);
  return candidates[0]||null;
}

function calcSolar(requiredPanels=1){
  let chosen=chooseAutomaticConnection(requiredPanels);
  const target=Math.max(1,Math.ceil(requiredPanels||1));
  let limited=false;
  if(!chosen){
    chosen=chooseMaximumSafeConnection();
    limited=!!chosen;
  }
  if(!chosen){
    ['seriesPanels','parallelStrings','actualPanelCount'].forEach(id=>$(id).value='—');
    $('connectionType').value='لا يوجد توصيل آمن';
    setStatus('autoConnectionStatus','❌ لا توجد أي تركيبة ضمن حدود MPPT الحالية. راجع VMP/VOC/IMP وحدود الجهد والتيار.',true);
    setStatus('mpptStatus','❌ لا توجد مصفوفة آمنة ضمن حدود MPPT الحالية.',true);
    $('solarDiagram').innerHTML='<div class="empty-diagram">⚠️ لا يمكن رسم توصيل آمن حتى تُصحح حدود MPPT أو بيانات الألواح.</div>';
    return null;
  }
  const {s,p,count,power,vmp,voc,imp,isc}=chosen;
  $('seriesPanels').value=s;$('parallelStrings').value=p;$('actualPanelCount').value=count;$('connectionType').value=`${s}S${p}P`;
  $('resultCount').textContent=fmt(count,0);
  $('resultPower').textContent=fmt(power,0)+' W';
  $('resultVmp').textContent=fmt(vmp)+' V'; $('resultVoc').textContent=fmt(voc)+' V';
  $('resultImp').textContent=fmt(imp)+' A'; $('resultIsc').textContent=fmt(isc)+' A';

  const active=activeMpptLimits();
  const lim=active.limits;
  const ok=vmp>=lim.minVmp&&vmp<=lim.maxVmp&&voc<=lim.maxVoc&&imp<=lim.maxCurrent;
  setStatus('mpptStatus',ok?`✅ ${s}S${p}P ضمن حدود ${active.source}: Vmp ${fmt(vmp)}V — Voc ${fmt(voc)}V — Imp ${fmt(imp)}A.`:'⚠️ توجد مشكلة في حدود MPPT.',!ok);
  const extra=count-target;
  if(limited){
    setStatus('autoConnectionStatus',`⚠️ المطلوب حسابيًا ${target} لوح، لكن أقصى توصيل آمن ضمن حدود ${chosen.source} الحالية هو ${s}S${p}P = ${count} ألواح (${fmt(power,0)}W). سيتم عرض العجز بدل إظهار «لا يوجد توصيل».`,true);
  }else{
    setStatus('autoConnectionStatus',extra>0?`🤖 التوصيل التلقائي: ${s}S${p}P = ${count} ألواح. المطلوب حسابيًا ${target} لوح، وتمت زيادة العدد لأن هذه أقرب تركيبة آمنة ضمن حدود MPPT.`:`🤖 التوصيل التلقائي: ${s}S${p}P = ${count} ألواح.`);
  }
  drawDiagram(s,p);
  protection(isc,voc,p);
  checkInverter(chosen);
  return chosen;
}

function drawDiagram(s,p){
  let html=`<div class="diagram-title">🔌 مخطط التوصيل: <strong>${s}S${p}P</strong></div>`;
  html+=`<div class="diagram-note">في كل سلسلة: <b>موجب (+)</b> لوح يتصل مع <b>سالب (−)</b> اللوح التالي. أطراف السلاسل بعد ذلك تتجمع على التوازي.</div>`;
  for(let j=0;j<p;j++){
    html+=`<div class="string"><b>السلسلة ${j+1} — ${s} ألواح على التوالي</b><div class="series-line">`;
    html+=`<span class="terminal minus">−</span>`;
    for(let i=0;i<s;i++){
      html+=`<div class="panel-wrap"><span class="panel"><span>لوح ${i+1}</span><small>${num('panelPower')}W</small><small>VMP ${num('panelVmp')}V</small><b>− &nbsp; +</b></span></div>`;
      if(i<s-1)html+=`<span class="series-wire">＋ ───── −</span>`;
    }
    html+=`<span class="terminal plus">＋</span></div><div class="string-end">خرج السلسلة: − سالب &nbsp; | &nbsp; + موجب</div></div>`;
  }
  html+=`<div class="parallel-box">🔗 ${p>1?`${p} سلاسل على التوازي — اربط جميع (+) معًا وجميع (−) معًا`:'سلسلة واحدة — لا يوجد توازي'}</div>`;
  html+=`<div class="mppt">${p>1?'🔗 صندوق تجميع DC / فيوزات السلاسل → ':''}🛡️ قاطع DC → ⚡ مدخل MPPT / الإنفرتر</div>`;
  $('solarDiagram').innerHTML=html;
}

function standardValue(x,arr){return arr.find(v=>v>=x)||arr[arr.length-1]}
function protection(isc,voc,p){
  const sf=Math.max(1,num('safetyFactor')||1.25),panelFuse=Math.max(1,num('panelMaxFuse')||20);
  const stringDesign=num('panelIsc')*sf,arrayDesign=isc*sf;
  const fuseCandidate=standardValue(stringDesign,[6,8,10,12,15,16,20,25,32,40,50,63]);
  const fuse=Math.min(fuseCandidate,panelFuse);
  const breaker=standardValue(arrayDesign,[10,16,20,25,32,40,50,63,80,100,125,160,200]);
  const spd=voc<=250?'275 V DC':voc<=600?'600 V DC':voc<=1000?'1000 V DC':'حسب مواصفة SPD والجهد الفعلي';
  $('stringIsc').textContent=fmt(num('panelIsc'))+' A';
  $('stringDesignCurrent').textContent=fmt(stringDesign)+' A';
  $('stringFuse').textContent=fmt(fuse,0)+' A DC';
  $('arrayIscProtection').textContent=fmt(isc)+' A';
  $('arrayDesignCurrent').textContent=fmt(arrayDesign)+' A';
  $('mainDcBreaker').textContent=fmt(breaker,0)+' A DC';
  $('spdVoltage').textContent=spd;
  $('protectionWarning').textContent=`⚠️ حساب مبدئي: يجب مطابقة فيوز السلسلة مع Isc و"Maximum Series Fuse" المكتوب على اللوح، ومطابقة القاطع وSPD والكابل مع الجهاز وطريقة التركيب والمعايير المحلية. معامل الأمان المستخدم ${fmt(sf,2)}.`;
}

function checkInverter(solar){
  if(!solar){$('inverterStatus').textContent='';return;}
  const inv=inverterLimits();
  if(!inv.maxVmp&&!inv.maxVoc&&!inv.maxCurrent){
    setStatus('inverterStatus','ℹ️ لم تُدخل حدود مدخل PV للإنفرتر بالكامل؛ تم الاعتماد على بيانات منظم MPPT في اختيار التوصيل.',true);
    return;
  }
  const voltageOk=(!inv.maxVmp || (solar.vmp>=inv.minVmp&&solar.vmp<=inv.maxVmp));
  const vocOk=(!inv.maxVoc || solar.voc<=inv.maxVoc);
  const currentOk=(!inv.maxCurrent || solar.imp<=inv.maxCurrent);
  const ok=voltageOk&&vocOk&&currentOk;
  setStatus('inverterStatus',ok?
    `✅ المصفوفة ${solar.s}S${solar.p}P ضمن حدود مدخل PV في الإنفرتر: Vmp ${fmt(solar.vmp)}V، Voc ${fmt(solar.voc)}V، Imp ${fmt(solar.imp)}A. قدرة PV = ${fmt(solar.power/1000,2)} kW، وهي مستقلة عن قدرة خرج الإنفرتر.`:
    `⚠️ فحص مدخل PV للإنفرتر: ${!voltageOk?'جهد Vmp خارج نطاق MPPT. ':''}${!vocOk?'Voc أعلى من الحد الأقصى. ':''}${!currentOk?'تيار Imp أعلى من الحد الأقصى. ':''}`,!ok);
}

function inverterCapacityCheck(peak){
  const userPower=num('inverterPower');
  const required=Math.max(0,peak*1.25);
  const suggested=Math.max(1000,Math.ceil(required/500)*500);
  const adequate=userPower>0 && userPower>=required;
  const el=$('inverterCapacityStatus');
  if(!el)return {userPower,required,suggested,adequate};
  if(!userPower){
    setStatus('inverterCapacityStatus',`ℹ️ القدرة اللحظية للأحمال ${fmt(peak,0)} W، والحجم الحسابي المقترح للإنفرتر ${fmt(suggested,0)} W.`,true);
  }else if(adequate){
    setStatus('inverterCapacityStatus',`✅ الإنفرتر المدخل ${fmt(userPower/1000,2)} kW يغطي قدرة الأحمال اللحظية المحسوبة ${fmt(peak/1000,2)} kW مع هامش 25%. زيادة الاستهلاك اليومي لا تغيّر قدرة الإنفرتر تلقائيًا؛ تؤثر أساسًا في الألواح والبطارية.`,false);
  }else{
    setStatus('inverterCapacityStatus',`⚠️ قدرة الأحمال اللحظية ${fmt(peak/1000,2)} kW أعلى من القدرة المناسبة للإنفرتر المدخل ${fmt(userPower/1000,2)} kW عند استخدام هامش 25%. راجع قدرة الإنفرتر.`,true);
  }
  return {userPower,required,suggested,adequate};
}

function calculateBatteryBank(requiredEnergyWh){
  const systemV=Math.max(1,num('systemVoltage')||24);
  const batteryV=Math.max(0,num('batteryVoltage')||systemV);
  const batteryAh=Math.max(0,num('batteryAh'));
  const dod=clamp(num('batteryDod')||80,1,100)/100;
  const eff=clamp(num('batteryEfficiency')||90,1,100)/100;
  const reserve=clamp(num('batteryReserve')||20,0,80)/100;

  if(!batteryV || !batteryAh){
    return {requiredAh:requiredEnergyWh/systemV,requiredWh:requiredEnergyWh,series:0,parallel:0,count:0,actualAh:0,actualWh:0,valid:false};
  }

  const requiredWh=requiredEnergyWh/(dod*eff)/(1-reserve);
  const ratio=systemV/batteryV;
  const nearest=Math.round(ratio);
  const compatible=Math.abs(ratio-nearest)<0.0001 && nearest>=1;

  if(!compatible){
    return {requiredAh:requiredWh/systemV,requiredWh,series:0,parallel:0,count:0,actualAh:0,actualWh:0,valid:false,
      warning:`جهد النظام ${fmt(systemV,0)}V لا يساوي مضاعفًا صحيحًا لجهد البطارية ${fmt(batteryV,0)}V. اختر بطارية مناسبة للنظام قبل اعتماد عدد البطاريات.`};
  }

  const series=nearest;
  const parallel=Math.max(1,Math.ceil(requiredWh/(batteryV*batteryAh*series)));
  const count=series*parallel;
  const actualAh=batteryAh*parallel;
  const actualWh=batteryV*series*actualAh;
  return {requiredAh:requiredWh/systemV,requiredWh,series,parallel,count,actualAh,actualWh,valid:true,warning:''};
}

function calculateChargeTime(solar,batteryBank){
  const currentSoc=clamp(num('chargeCurrentSoc'),0,100);
  const targetSoc=clamp(num('chargeTargetSoc'),0,100);
  const chargeEff=clamp(num('chargeEfficiency')||90,50,100)/100;
  const batteryV=Math.max(0,num('batteryVoltage'));
  const batteryAh=Math.max(0,num('batteryAh'));
  const nominalWh=batteryBank?.valid && batteryBank.actualWh>0 ? batteryBank.actualWh : batteryV*batteryAh;
  const deltaSoc=Math.max(0,targetSoc-currentSoc)/100;
  const energyNeeded=nominalWh*deltaSoc;
  const autoPower=Math.max(0,Number(solar?.power)||0);
  const manualPower=Math.max(0,num('chargePower'));
  const powerUsed=manualPower>0?manualPower:autoPower;
  const effectivePower=powerUsed*chargeEff;
  const hours=energyNeeded>0 && effectivePower>0 ? energyNeeded/effectivePower : 0;

  if($('chargeNominalWh'))$('chargeNominalWh').textContent=fmt(nominalWh,0)+' Wh';
  if($('chargeEnergyWh'))$('chargeEnergyWh').textContent=fmt(energyNeeded,0)+' Wh';
  if($('chargePowerUsed'))$('chargePowerUsed').textContent=fmt(powerUsed,0)+' W';
  if($('chargeTimeHours'))$('chargeTimeHours').textContent=hours>0?fmt(hours,2)+' ساعة':'—';

  let message='';
  let warning=false;
  if(targetSoc<=currentSoc){
    message='ℹ️ نسبة الشحن المطلوبة لا تتجاوز نسبة الشحن الحالية؛ لا توجد طاقة إضافية مطلوبة.';
  }else if(!nominalWh){
    message='⚠️ أدخل جهد وسعة البطارية لحساب زمن الشحن.'; warning=true;
  }else if(!powerUsed){
    message='⚠️ لا توجد قدرة شحن متاحة. أدخل قدرة الشحن أو احسب مصفوفة شمسية آمنة أولًا.'; warning=true;
  }else{
    message=`⏱️ من ${fmt(currentSoc,0)}% إلى ${fmt(targetSoc,0)}%: الطاقة المطلوبة ${fmt(energyNeeded,0)} Wh، وقدرة الشحن المستخدمة ${fmt(powerUsed,0)} W، والكفاءة ${fmt(chargeEff*100,0)}% → زمن تقريبي <strong>${fmt(hours,2)} ساعة</strong>.`;
  }
  setStatus('chargeTimeStatus',message,warning);
  return {currentSoc,targetSoc,chargeEff,nominalWh,energyNeeded,powerUsed,hours};
}

function calculateACProtection(peak){
  const voltage=Math.max(1,num('acVoltage')||230);
  const pf=clamp(num('acPowerFactor')||1,0.5,1);
  const sf=Math.max(1,num('acSafetyFactor')||1.25);
  const current=peak/(voltage*pf);
  const designCurrent=current*sf;
  const breakers=[6,10,16,20,25,32,40,50,63,80,100,125,160,200];
  const breaker=standardValue(designCurrent,breakers);
  const length=Math.max(0,num('acCableLength'));
  const dropMax=Math.max(0,num('acMaxVoltageDrop')||3);
  const material=$('acCableMaterial')?.value||'copper';
  const rho=material==='aluminum'?0.0282:0.0175;
  const cableTable=[
    [1.5,15],[2.5,20],[4,25],[6,32],[10,45],[16,60],[25,80],[35,100],[50,125],[70,160],[95,200]
  ];
  const dropFor=size=>designCurrent*2*length*rho/size;
  const pctFor=size=>voltage?dropFor(size)/voltage*100:0;
  const selected=cableTable.find(([size,amp])=>amp>=breaker && pctFor(size)<=dropMax) || cableTable[cableTable.length-1];
  const selectedSize=selected[0],selectedAmp=selected[1];
  const drop=dropFor(selectedSize),dropPct=pctFor(selectedSize);

  if($('acLoadPower'))$('acLoadPower').textContent=fmt(peak,0)+' W';
  if($('acLoadCurrent'))$('acLoadCurrent').textContent=fmt(current,2)+' A';
  if($('acDesignCurrent'))$('acDesignCurrent').textContent=fmt(designCurrent,2)+' A';
  if($('acMainBreaker'))$('acMainBreaker').textContent=fmt(breaker,0)+' A';
  if($('acSuggestedCable'))$('acSuggestedCable').textContent=fmt(selectedSize,1)+' mm²';
  if($('acVoltageDrop'))$('acVoltageDrop').textContent=fmt(drop,2)+' V ('+fmt(dropPct,2)+'%)';

  const cableAdequate=selectedAmp>=breaker && dropPct<=dropMax;
  setStatus('acProtectionStatus',
    `⚡ الحمل اللحظي ${fmt(peak,0)} W → التيار ${fmt(current,2)} A → تيار التصميم ${fmt(designCurrent,2)} A → القاطع الرئيسي ${fmt(breaker,0)} A. الكابل المقترح ${fmt(selectedSize,1)} mm²، وهبوط الجهد ${fmt(dropPct,2)}%.`,
    !cableAdequate
  );
  if($('acProtectionWarning'))$('acProtectionWarning').textContent='⚠️ الحساب مبدئي لقاطع/كابل دائرة AC أحادية الطور. يجب مطابقة القاطع مع مقطع الكابل وطريقة التركيب ودرجة الحرارة وقدرة القطع ونوع الحمل ومتطلبات الكود المحلي. الأحمال ذات تيار الإقلاع مثل الثلاجات والمضخات تحتاج مراجعة منفصلة.';
  return {voltage,pf,current,designCurrent,breaker,cable:selectedSize,drop,dropPct};
}

function calculateCable(){
  const solar=window.lastSolar||calcSolar(window.lastRequiredPanels||1);
  if(!solar)return;
  const length=Math.max(0,num('cableLength')),dropMax=Math.max(0,num('maxVoltageDrop')||3);
  const material=$('cableMaterial').value,rho=material==='aluminum'?0.0282:0.0175;
  const current=solar.imp*1.25,voltage=solar.vmp;
  const sizes=[2.5,4,6,10,16,25,35,50,70,95,120];
  const selectedInput=num('cableSize')||6;
  const dropFor=size=>current*2*length*rho/size;
  const pctFor=size=>voltage?dropFor(size)/voltage*100:0;
  const autoSize=sizes.find(s=>pctFor(s)<=dropMax)||sizes[sizes.length-1];
  const chosenSize=selectedInput;
  const drop=dropFor(chosenSize),pct=pctFor(chosenSize);
  $('cableCurrent').textContent=fmt(current)+' A';$('cableVoltage').textContent=fmt(voltage)+' V';
  $('voltageDrop').textContent=fmt(drop,2)+' V';$('voltageDropPercent').textContent=fmt(pct,2)+' %';
  $('selectedCable').textContent=fmt(chosenSize,1)+' mm²';
  setStatus('cableStatus',pct<=dropMax?`✅ هبوط الجهد ضمن ${fmt(dropMax,1)}%. المقاس المقترح حسابيًا: ${fmt(autoSize,1)} mm².`:`⚠️ هبوط الجهد أعلى من ${fmt(dropMax,1)}%. المقاس المقترح حسابيًا: ${fmt(autoSize,1)} mm².`,pct>dropMax);
  $('cableWarning').textContent='⚠️ هذا الحساب لهبوط الجهد فقط. يجب أيضًا فحص تحمل الكابل للتيار، درجة الحرارة، طريقة التركيب، طول المسار الحقيقي، ونوع العزل.';
}

/* ================= تنبيهات بيانات اللوح وجهد النظام ================= */

function initPanelReference(){
  const preset=selectedPanelPreset();
  if(preset){
    window.panelReference={power:preset.power,vmp:preset.vmp,voc:preset.voc,imp:preset.imp,isc:preset.isc};
  }else if(!window.panelReference){
    window.panelReference={power:num('panelPower'),vmp:num('panelVmp'),voc:num('panelVoc'),imp:num('panelImp'),isc:num('panelIsc')};
  }
  return window.panelReference;
}

function panelDataWarning(){
  const ref=initPanelReference();
  const power=num('panelPower'),vmp=num('panelVmp'),voc=num('panelVoc'),imp=num('panelImp'),isc=num('panelIsc');
  const changed=[];
  const lower=[];
  const addChange=(label,current,original,unit)=>{
    if(Math.abs(current-original)>0.0001){
      changed.push(`${label}: ${fmt(original)} → ${fmt(current)} ${unit}`);
      if(current<original)lower.push(`${label} انخفض عن القيمة المرجعية (${fmt(original)} ${unit})`);
    }
  };
  addChange('VMP',vmp,ref.vmp,'V');
  addChange('VOC',voc,ref.voc,'V');
  addChange('IMP',imp,ref.imp,'A');
  addChange('ISC',isc,ref.isc,'A');
  addChange('قدرة اللوح',power,ref.power,'W');

  const electricalPower=vmp*imp;
  const mismatch=power>0?Math.abs(electricalPower-power)/power:0;
  const messages=[];
  if(lower.length)messages.push(`⚠️ ${lower.join('، ')}.`);
  if(mismatch>0.05){
    messages.push(`⚠️ VMP × IMP = ${fmt(electricalPower,0)} W بينما قدرة اللوح المدخلة ${fmt(power,0)} W؛ الفرق ${fmt(mismatch*100,1)}%. راجع القيم المكتوبة على ملصق اللوح.`);
  }
  if(changed.length && !messages.length){
    messages.push(`⚠️ تم تعديل بيانات اللوح عن القيم المرجعية عند فتح الحاسبة: ${changed.join('، ')}. تأكد من مطابقتها مع ملصق اللوح.`);
  }

  let el=$('panelDataWarning');
  if(!el){
    const section=document.querySelector('#solar .grid');
    if(section){
      el=document.createElement('div');
      el.id='panelDataWarning';
      el.className='warning';
      el.style.gridColumn='1 / -1';
      section.appendChild(el);
    }
  }
  if(el){
    el.innerHTML=messages.length?messages.join('<br>'):'✅ بيانات اللوح متوافقة مع القيم المرجعية والقدرة المحسوبة من VMP × IMP.';
    el.className=messages.length?'warning':'status';
  }
  return messages;
}

function systemVoltageUpgradeWarning(systemV,peakW){
  const v=Number(systemV)||0;
  const peak=Math.max(0,Number(peakW)||0);
  if(v!==12 || peak<=3500)return '';
  return `🔴 <strong>تنبيه ترقية النظام:</strong> الحمل اللحظي ${fmt(peak,0)} W تجاوز حد 3,500 W المقترح لنظام 12V. راجع ترقية جهد النظام إلى <strong>24V أو 48V</strong> لتقليل تيار البطارية والكابلات، مع مراجعة قدرة الإنفرتر والبطاريات والحماية.`;
}

function calculateAll(){
  const total=dailyTotal();
  const loss=Math.max(1,num('lossFactor')||1.25);
  const sun=Math.max(0.1,num('sunHours')||5.5);
  const climate=clamp(num('climateFactor')||1,0.5,1.2);
  const withLoss=total*loss;
  const solarRequired=withLoss/(sun*climate);
  const panelPower=Math.max(1,num('panelPower')||1);
  const suggested=Math.max(1,Math.ceil(solarRequired/panelPower));
  window.lastRequiredPanels=suggested;

  const dod=clamp(num('batteryDod')||80,1,100)/100;
  const eff=clamp(num('batteryEfficiency')||90,1,100)/100;
  const reserve=clamp(num('batteryReserve')||20,0,80)/100;
  const v=Math.max(1,num('systemVoltage')||24);
  const battery=calculateBatteryBank(withLoss);
  const peak=peakLoad();
  const panelWarning=panelDataWarning();
  const voltageUpgradeWarning=systemVoltageUpgradeWarning(v,peak);
  const invCheck=inverterCapacityCheck(peak);
  const invUser=invCheck.userPower;
  const invSuggested=invCheck.suggested;
  const invFinal=invUser>0?invUser:invSuggested;
  const acProtection=calculateACProtection(peak);

  $('dailyTotal').textContent=fmt(Math.round(total),0);
  $('summaryDaily').textContent=fmt(Math.round(total),0);
  $('summaryWithLoss').textContent=fmt(Math.round(withLoss),0);
  $('requiredSolar').textContent=fmt(solarRequired/1000,2);
  $('suggestedPanels').textContent=fmt(suggested,0);
  $('requiredBatteryAh').textContent=fmt(Math.ceil(battery.requiredAh),0);
  if($('requiredBatteryWh'))$('requiredBatteryWh').textContent=fmt(Math.round(battery.requiredWh),0);
  $('suggestedInverter').textContent=fmt(invFinal,0);
  $('detailEnergy').textContent=fmt(Math.round(withLoss),0);
  $('detailVoltage').textContent=fmt(v,0);
  $('detailDod').textContent=fmt(dod*100,0);
  $('detailEfficiency').textContent=fmt(eff*100,0);
  $('detailBattery').textContent=fmt(Math.ceil(battery.requiredAh),0);
  if($('detailBatteryWh'))$('detailBatteryWh').textContent=fmt(Math.round(battery.requiredWh),0);
  if($('detailUsableEnergy'))$('detailUsableEnergy').textContent=fmt(Math.round(withLoss),0);

  $('batteryCount').value=battery.valid?battery.count:'—';
  $('batteryConnection').value=battery.valid?`${battery.series}S${battery.parallel}P`:'—';
  $('batterySeries').value=battery.valid?battery.series:'—';
  $('batteryParallel').value=battery.valid?battery.parallel:'—';
  if($('detailBatteryCount'))$('detailBatteryCount').textContent=battery.valid?fmt(battery.count,0):'—';
  if($('detailBatteryConnection'))$('detailBatteryConnection').textContent=battery.valid?`${battery.series}S${battery.parallel}P`:'غير متوافق';
  if($('detailBankAh'))$('detailBankAh').textContent=battery.valid?fmt(battery.actualAh,0):'—';

  const solar=calcSolar(suggested);window.lastSolar=solar;
  if(solar)checkInverter(solar);
  const charge=calculateChargeTime(solar,battery);

  const currentBankAh=num('batteryAh'),countBank=Math.max(0,battery.valid?battery.count:0);
  const bankStatus=battery.valid
    ? `البنك المحسوب ${fmt(countBank,0)} بطارية (${battery.series}S${battery.parallel}P) بسعة بنك ${fmt(battery.actualAh,0)} Ah، وطاقة اسمية ${fmt(battery.actualWh,0)} Wh.`
    : (battery.warning||'تعذر حساب بنك البطارية.');

  let solarNote='';
  if(solar && solar.count < suggested){
    const deficitW=Math.max(0,solarRequired-(solar.power||0));
    solarNote=`<p>⚠️ <strong>تنبيه الطاقة الشمسية:</strong> المطلوب تقريبًا ${fmt(solarRequired/1000,2)} kW من PV، بينما التوصيل الآمن الحالي يوفر ${fmt((solar.power||0)/1000,2)} kW؛ العجز التقريبي ${fmt(deficitW/1000,2)} kW. زيادة الاستهلاك اليومي لا تغيّر قدرة خرج الإنفرتر تلقائيًا، لكنها قد تتطلب ألواحًا/بطارية أكبر أو MPPT يسمح بمصفوفة أكبر.</p>`;
  }

  $('systemSummary').innerHTML=`
    <p>💡 الاستهلاك اليومي: <strong>${fmt(Math.round(total),0)} Wh/day</strong>، وبعد معامل الفقد: <strong>${fmt(Math.round(withLoss),0)} Wh/day</strong>.</p>
    <p>☀️ المصفوفة: <strong>${solar?solar.s+'S'+solar.p+'P':'لا يوجد توصيل مناسب'}</strong> — ${solar?fmt(solar.count,0):'-'} لوح فعلي.</p>
    <p>📐 القدرة المطلوبة من الألواح: <strong>${fmt(solarRequired/1000,2)} kW</strong>، وعدد الألواح الحسابي قبل التوصيل: <strong>${fmt(suggested,0)}</strong>.</p>
    <p>🔋 الطاقة المطلوبة من بنك البطارية بعد DOD والكفاءة والاحتياطي: <strong>${fmt(Math.round(battery.requiredWh),0)} Wh</strong> على نظام <strong>${fmt(v,0)} V</strong>.</p>
    <p>🔋 البطارية المختارة: <strong>${selectedBatteryPreset().label}</strong> → العدد المطلوب <strong>${battery.valid?fmt(battery.count,0):'—'}</strong>، التوصيل <strong>${battery.valid?`${battery.series}S${battery.parallel}P`:'—'}</strong>.</p>
    <p>🔋 ${bankStatus}</p>
    <p>⏱️ زمن شحن البطارية التقديري: <strong>${charge.hours>0?fmt(charge.hours,2)+' ساعة':'—'}</strong> (من ${fmt(charge.currentSoc,0)}% إلى ${fmt(charge.targetSoc,0)}%).</p>
    <p>🛡️ مسار القواطع مستقل: الأحمال اللحظية <strong>${fmt(Math.round(peak),0)} W</strong> → تيار AC: <strong>${fmt(acProtection.current,2)} A</strong> → القاطع الرئيسي: <strong>${fmt(acProtection.breaker,0)} A</strong> → الكابل المبدئي: <strong>${fmt(acProtection.cable,1)} mm²</strong>.</p>
    <p>〰️ قدرة الإنفرتر المدخلة: <strong>${fmt(invFinal,0)} W</strong>، والحجم الحسابي مع هامش 25%: <strong>${fmt(invSuggested,0)} W</strong>.</p>
    ${solarNote}
    ${battery.warning?`<p>⚠️ ${battery.warning}</p>`:''}
    ${voltageUpgradeWarning?`<p class="warning">${voltageUpgradeWarning}</p>`:''}
    <p>📌 قدرة خرج الإنفرتر تُفحص من الأحمال اللحظية، بينما قدرة PV تُفحص من حدود MPPT/Voc/Imp بشكل مستقل.</p>`;
  calculateCable();
}

function collectData(){
  const ids=['location','sunHours','systemVoltage','systemType','batteryPreset','lossFactor','panelPower','panelVmp','panelVoc','panelImp','panelIsc','climateFactor','batteryType','batteryVoltage','batteryAh','batteryCount','batteryDod','batteryEfficiency','batteryReserve','chargeCurrentSoc','chargeTargetSoc','chargeEfficiency','chargePower','inverterPower','inverterSystemVoltage','inverterOperatingVoltage','inverterMaxVoltage','inverterMpptMin','inverterMpptMax','inverterPvCurrent','inverterMaxPvPower','controllerType','panelVoltage','mpptMinVmp','mpptMaxVmp','mpptMaxVoc','controllerCurrent','controllerMaxPvPower','safetyFactor','panelMaxFuse','acVoltage','acPowerFactor','acSafetyFactor','acCableLength','acMaxVoltageDrop','acCableMaterial','cableLength','maxVoltageDrop','cableMaterial','cableSize'];
  const data={};ids.forEach(id=>{if($(id))data[id]=$(id).value});data.loads=getLoads();return data;
}
function saveResults(){localStorage.setItem('solarCalculatorData',JSON.stringify(collectData()));alert('تم حفظ البيانات على هذا الجهاز بنجاح.');}
function loadResults(){
  const raw=localStorage.getItem('solarCalculatorData');
  if(!raw){alert('لا توجد بيانات محفوظة على هذا الجهاز.');return;}
  try{
    const d=JSON.parse(raw);Object.keys(d).forEach(k=>{if(k!=='loads'&&$(k))$(k).value=d[k]});
    $('loadsBody').innerHTML='';(d.loads||[]).forEach(addLoad);calculateAll();alert('تم تحميل البيانات المحفوظة.');
  }catch(e){alert('تعذر تحميل البيانات المحفوظة.');}
}
function resetCalculator(){
  if(!confirm('هل تريد إعادة الحاسبة إلى الإعدادات الافتراضية؟'))return;
  localStorage.removeItem('solarCalculatorData');location.reload();
}
function exportPDF(){calculateAll();setTimeout(()=>window.print(),80)}

function syncSystemVoltage(){
  const v=$('systemVoltage').value;
  $('inverterSystemVoltage').value=v;$('panelVoltage').value=v;
  syncBatteryPresets();
}

window.addEventListener('load',()=>{
  if('serviceWorker' in navigator){navigator.serviceWorker.register('./service-worker.js').catch(()=>{});}
});

document.addEventListener('DOMContentLoaded',()=>{
  defaultLoads.forEach(addLoad);
  syncBatteryPresets();
  syncPanelPresets('700');
  $('panelPreset')?.addEventListener('change',()=>{
    const id=$('panelPreset').value;
    const preset=selectedPanelPreset();
    if(preset){
      applyPanelPreset(preset);
      window.panelReference={power:preset.power,vmp:preset.vmp,voc:preset.voc,imp:preset.imp,isc:preset.isc};
    }else{
      window.panelReference={power:num('panelPower'),vmp:num('panelVmp'),voc:num('panelVoc'),imp:num('panelImp'),isc:num('panelIsc')};
    }
    calculateAll();
  });
  ['panelPower','panelVmp','panelVoc','panelImp','panelIsc'].forEach(id=>$(id)?.addEventListener('input',()=>{
    if($('panelPreset') && $('panelPreset').value!=='manual')$('panelPreset').value='manual';
    if(!window.panelReference){
      window.panelReference={power:num('panelPower'),vmp:num('panelVmp'),voc:num('panelVoc'),imp:num('panelImp'),isc:num('panelIsc')};
    }
    calculateAll();
  }));
  $('systemVoltage').addEventListener('change',()=>{syncSystemVoltage();calculateAll()});
  $('batteryPreset')?.addEventListener('change',()=>{applyBatteryPreset(selectedBatteryPreset());calculateAll()});
  document.querySelectorAll('input,select').forEach(el=>{
    el.addEventListener('change',calculateAll);
    el.addEventListener('input',calculateAll);
  });
  calculateAll();
});
