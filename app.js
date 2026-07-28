// PUBLIC DEMO: All operational figures below are synthetic and do not represent a real company.
const calibreCapacity = {
  LEVREK: {
    "100–200 g": [210, 235, 264], "200–300 g": [1700, 1950, 2250],
    "300–400 g": [8200, 9100, 10050], "400–600 g": [28500, 30500, 32900],
    "600–800 g": [9700, 10750, 12000], "800–1000 g": [3100, 3550, 4100],
    "1000–1500 g": [1100, 1450, 1900], "1500–2000 g": [120, 190, 290],
    "2000–3000 g": [5, 12, 22]
  },
  CIPURA: {
    "100–200 g": [95, 108, 122], "200–300 g": [760, 850, 960],
    "300–400 g": [3600, 4100, 4700], "400–600 g": [8500, 9400, 10500],
    "600–800 g": [2100, 2500, 3000], "800–1000 g": [420, 560, 720],
    "1000–1500 g": [15, 28, 48]
  }
};

const monthlyProduction = [
  ["Oca",1920,1],["Şub",1840,1],["Mar",2080,1],["Nis",1960,1],["May",1790,1],["Haz",2030,1],
  ["Tem",2010,0],["Ağu",1980,0],["Eyl",2050,0],["Eki",1990,0],["Kas",2020,0],["Ara",2110,0]
];
const leadingCalibres = [
  ["Levrek 400–600",9300,"levrek"],["Levrek 600–800",3180,"levrek"],["Çipura 400–600",2760,"cipura"],
  ["Levrek 300–400",2510,"levrek"],["Çipura 300–400",1180,"cipura"],["Levrek 800–1000",980,"levrek"]
];

const state = {
  results: null,
  notes: "",
  thresholds: { low: .95, medium: .80, high: .50 },
  currentKpi: null
};

const processingYields = { WHOLE: 1, CLEANED: .80, PBI: .42, PBO: .46 };
const processingLabels = { WHOLE: "Bütün balık", CLEANED: "Temizlenmiş / D&G", PBI: "Fileto PBI", PBO: "Fileto PBO" };
const simulationCount = ModelEngine.DEFAULT_SIMULATION_COUNT;

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const today = new Date();
const nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function iso(date){ return new Date(date.getTime() - date.getTimezoneOffset()*60000).toISOString().slice(0,10); }
function plusDays(date, n){ const copy = new Date(date); copy.setDate(copy.getDate()+n); return copy; }
function dateValue(value){ return new Date(`${value}T12:00:00`); }
function kg(value){ return `${nf0.format(Math.max(0,value||0))} kg`; }
function tonnes(value){ return `${nf1.format(Math.max(0,value||0)/1000)} ton`; }
function pct(value){ return `%${nf1.format(Math.max(0,Math.min(1,value||0))*100)}`; }
function money(value,currency="TRY"){
  return new Intl.NumberFormat("tr-TR",{style:"currency",currency,maximumFractionDigits:0}).format(Math.max(0,value||0));
}
function currencyTotals(lines,field){ return ["TRY","EUR","USD"].reduce((out,currency)=>{out[currency]=lines.filter(x=>x.currency===currency).reduce((sum,x)=>sum+x[field],0);return out;},{}); }
function currencySummary(totals){ const values=["EUR","USD","TRY"].filter(c=>(totals[c]||0)>.005).map(c=>money(totals[c],c)); return values.length?values.join(" + "):money(0,"TRY"); }
function currencyDifference(before,after){ return ["TRY","EUR","USD"].reduce((out,c)=>{out[c]=Math.max(0,(before[c]||0)-(after[c]||0));return out;},{}); }
function productionDates(startValue,endValue){
  const start=dateValue(startValue),end=dateValue(endValue),dates=[];
  if(isNaN(start)||isNaN(end)||end<start) return dates;
  const cursor=new Date(start);
  while(cursor<=end){ if(cursor.getDay()!==0) dates.push(iso(cursor)); cursor.setDate(cursor.getDate()+1); }
  return dates;
}
function riskFor(probability){
  if(probability>=state.thresholds.low) return {label:"Düşük",className:"low"};
  if(probability>=state.thresholds.medium) return {label:"Orta",className:"medium"};
  if(probability>=state.thresholds.high) return {label:"Yüksek",className:"high"};
  return {label:"Çok yüksek",className:"very-high"};
}
function populateCalibres(select,product,current){
  select.innerHTML=Object.keys(calibreCapacity[product]).map(c=>`<option value="${c}">${c}</option>`).join("");
  select.value=calibreCapacity[product][current]?current:"400–600 g";
}
function nextAlternative(product,current){
  const all=Object.keys(calibreCapacity[product]); const index=all.indexOf(current);
  return all[Math.min(all.length-1,index+1)]||all[0];
}

function processingYield(form){ return processingYields[form] || 1; }
function updateConversionHint(row){
  const form=row.querySelector(".product-form").value;
  const demand=Math.max(0,Number(row.querySelector(".demand").value)||0);
  const raw=demand/processingYield(form);
  row.querySelector(".conversion-hint").textContent=form==="WHOLE"
    ? "Kapasite ihtiyacı: sipariş miktarıyla aynı"
    : `Kapasite ihtiyacı: ${nf0.format(raw)} kg bütün balık eşdeğeri (${nf0.format(processingYield(form)*100)}% verim)`;
}

function addOrderLine(values={}){
  const row=$("#order-template").content.firstElementChild.cloneNode(true);
  const set=(s,v)=>{ if(v!==undefined) row.querySelector(s).value=v; };
  set(".order-id",values.orderId??`SP-${String($("#order-lines").children.length+1).padStart(3,"0")}`);
  set(".line-id",values.lineId??1); set(".customer",values.customer??"Örnek Müşteri"); set(".market",values.market||"İhracat");
  set(".product",values.product||"LEVREK"); set(".product-form",values.form||"WHOLE"); populateCalibres(row.querySelector(".calibre"),row.querySelector(".product").value,values.calibre||"400–600 g");
  set(".demand",values.demand??10000); set(".unit-price",values.price??6); set(".currency",values.currency||"EUR");
  set(".planned-date",values.planned??iso(plusDays(today,2))); set(".delivery-flex",values.deliveryFlex||"NO"); set(".latest-date",values.latest??values.planned??iso(plusDays(today,2)));
  set(".priority",values.priority||"1"); set(".alt-allowed",values.altAllowed||"NO"); set(".line-note",values.note||"");
  const alt=row.querySelector(".alt-calibre"); populateCalibres(alt,row.querySelector(".product").value,values.altCalibre||nextAlternative(row.querySelector(".product").value,row.querySelector(".calibre").value));
  alt.disabled=row.querySelector(".alt-allowed").value!=="YES";
  const deliveryFlex=row.querySelector(".delivery-flex"),latest=row.querySelector(".latest-date"),planned=row.querySelector(".planned-date");
  latest.disabled=deliveryFlex.value!=="YES"; if(latest.disabled) latest.value=planned.value;
  row.querySelector(".product").addEventListener("change",()=>{ const p=row.querySelector(".product").value; populateCalibres(row.querySelector(".calibre"),p); populateCalibres(alt,p); });
  row.querySelector(".calibre").addEventListener("change",()=>{ if(row.querySelector(".alt-allowed").value==="YES") alt.value=nextAlternative(row.querySelector(".product").value,row.querySelector(".calibre").value); });
  row.querySelector(".alt-allowed").addEventListener("change",e=>{ alt.disabled=e.target.value!=="YES"; });
  deliveryFlex.addEventListener("change",()=>{ latest.disabled=deliveryFlex.value!=="YES"; if(latest.disabled) latest.value=planned.value; else if(latest.value<=planned.value) latest.value=iso(plusDays(dateValue(planned.value),2)); });
  planned.addEventListener("change",()=>{ if(deliveryFlex.value!=="YES") latest.value=planned.value; else if(latest.value<planned.value) latest.value=planned.value; });
  row.querySelector(".product-form").addEventListener("change",()=>updateConversionHint(row));
  row.querySelector(".demand").addEventListener("input",()=>updateConversionHint(row));
  row.querySelector(".remove-row").addEventListener("click",()=>{ if($("#order-lines").children.length>1) row.remove(); });
  if(values._fromImport) row.dataset.imported="true";
  row.dataset.commercialCalibre=values.commercialCalibre||"";
  updateConversionHint(row);
  $("#order-lines").appendChild(row); updateFilterOptions();
}

function addStockLine(values={}){
  const row=$("#stock-template").content.firstElementChild.cloneNode(true);
  const set=(s,v)=>{ if(v!==undefined) row.querySelector(s).value=v; };
  set(".lot-id",values.lot||`LOT-${String($("#stock-lines").children.length+1).padStart(3,"0")}`); set(".facility",values.facility||"Tesis A");
  set(".stock-product",values.product||"LEVREK"); populateCalibres(row.querySelector(".stock-calibre"),row.querySelector(".stock-product").value,values.calibre||"400–600 g");
  set(".stock-kg",values.amount??0); set(".stock-date",values.date||iso(today)); set(".stock-status",values.status||"FREE"); set(".reserved-for",values.reservedFor||"");
  row.querySelector(".reserved-for").disabled=row.querySelector(".stock-status").value!=="RESERVED";
  row.querySelector(".stock-product").addEventListener("change",()=>populateCalibres(row.querySelector(".stock-calibre"),row.querySelector(".stock-product").value));
  row.querySelector(".stock-status").addEventListener("change",e=>{ row.querySelector(".reserved-for").disabled=e.target.value!=="RESERVED"; });
  row.querySelector(".remove-row").addEventListener("click",()=>row.remove()); $("#stock-lines").appendChild(row);
}
function addCapacityLine(values={}){
  const row=$("#capacity-template").content.firstElementChild.cloneNode(true);
  Object.entries({".capacity-date":values.date||iso(today),".capacity-product":values.product||"LEVREK",".capacity-kg":values.kg||0,".available-lines":values.lines||2,".available-shifts":values.shifts||2,".downtime":values.downtime||0}).forEach(([s,v])=>row.querySelector(s).value=v);
  populateCalibres(row.querySelector(".capacity-calibre"),row.querySelector(".capacity-product").value,values.calibre||"400–600 g");
  row.querySelector(".capacity-product").addEventListener("change",()=>populateCalibres(row.querySelector(".capacity-calibre"),row.querySelector(".capacity-product").value));
  row.querySelector(".remove-row").addEventListener("click",()=>row.remove()); $("#capacity-lines").appendChild(row);
}

function readOrders(){ return $$(".order-line").map((row,index)=>({
  index:index+1,orderId:row.querySelector(".order-id").value.trim(),lineId:row.querySelector(".line-id").value.trim(),customer:row.querySelector(".customer").value.trim(),
  market:row.querySelector(".market").value,product:row.querySelector(".product").value,form:row.querySelector(".product-form").value,calibre:row.querySelector(".calibre").value,commercialCalibre:row.dataset.commercialCalibre||row.querySelector(".calibre").value,demand:Number(row.querySelector(".demand").value),
  rawDemand:Number(row.querySelector(".demand").value)/processingYield(row.querySelector(".product-form").value),yieldRate:processingYield(row.querySelector(".product-form").value),
  price:Number(row.querySelector(".unit-price").value),currency:row.querySelector(".currency").value,planned:row.querySelector(".planned-date").value,deliveryFlexible:row.querySelector(".delivery-flex").value==="YES",latest:row.querySelector(".delivery-flex").value==="YES"?row.querySelector(".latest-date").value:row.querySelector(".planned-date").value,
  priority:Number(row.querySelector(".priority").value),altAllowed:row.querySelector(".alt-allowed").value==="YES",altCalibre:row.querySelector(".alt-calibre").value,note:row.querySelector(".line-note").value.trim()
})); }
function readStocks(){ return $$(".stock-line").map(row=>({lot:row.querySelector(".lot-id").value.trim(),facility:row.querySelector(".facility").value,product:row.querySelector(".stock-product").value,calibre:row.querySelector(".stock-calibre").value,amount:Number(row.querySelector(".stock-kg").value),date:row.querySelector(".stock-date").value,status:row.querySelector(".stock-status").value,reservedFor:row.querySelector(".reserved-for").value.trim()})).filter(s=>s.amount>0); }
function readCapacities(){ return $$(".capacity-line").map(row=>({date:row.querySelector(".capacity-date").value,product:row.querySelector(".capacity-product").value,calibre:row.querySelector(".capacity-calibre").value,amount:Number(row.querySelector(".capacity-kg").value),lines:Number(row.querySelector(".available-lines").value),shifts:Number(row.querySelector(".available-shifts").value),downtime:Number(row.querySelector(".downtime").value)})).filter(x=>x.date&&x.amount>0); }

function validateData(show=true){
  const orders=readOrders(),stocks=readStocks(),errors=[],analysisDate=$("#analysis-date").value;
  if(!orders.length) errors.push("En az bir sipariş kalemi eklenmelidir.");
  orders.forEach(o=>{
    if(!o.orderId||!o.lineId||!o.customer) errors.push(`${o.index}. kalemde sipariş, kalem veya müşteri bilgisi eksik.`);
    if(!o.demand||o.demand<=0) errors.push(`${o.index}. kalemde miktar sıfırdan büyük olmalıdır.`);
    if(o.price<0) errors.push(`${o.index}. kalemde fiyat geçersiz.`);
    if(!o.planned) errors.push(`${o.index}. kalemde planlanan teslim tarihi eksik.`);
    if(o.planned&&analysisDate&&o.planned<analysisDate) errors.push(`${o.index}. kalemde teslim tarihi hesaplama tarihinden önce olamaz.`);
    if(o.deliveryFlexible&&!o.latest) errors.push(`${o.index}. kalemde esnek teslimat için en geç tarih zorunludur.`);
    if(o.deliveryFlexible&&o.planned&&o.latest&&o.latest<o.planned) errors.push(`${o.index}. kalemde en geç tarih planlanan tarihten önce olamaz.`);
    if(o.altAllowed&&!o.altCalibre) errors.push(`${o.index}. kalemde kabul edilen alternatif kalibre seçilmelidir.`);
  });
  stocks.forEach((s,i)=>{ if(s.status==="RESERVED"&&!s.reservedFor) errors.push(`${i+1}. stok partisinde ayrıldığı müşteri veya sipariş eksik.`); });
  if(show){ const box=$("#validation-message"); box.className=`validation-message show ${errors.length?"error":"success"}`; box.innerHTML=errors.length?`<strong>${errors.length} kontrol uyarısı:</strong> ${errors.join(" ")}`:`<strong>Veri kontrolü tamamlandı.</strong> ${orders.length} kalem ve ${stocks.length} stok partisi hesaplamaya uygun.`; }
  return {valid:!errors.length,orders,stocks,errors};
}

function calculateResults(orders,stocks){
  const analysisDate=$("#analysis-date").value,flexLimit=Math.min(12,Math.max(0,Number($("#flex-limit").value)))/100;
  const planningQuantile=Math.max(.01,Math.min(.50,1-state.thresholds.low));
  const customCapacities=readCapacities();
  const dailySampleCache=new Map();
  const emptySamples=()=>Array(simulationCount).fill(0);
  const dailySamples=(product,calibre,date)=>{
    const matching=customCapacities.filter(x=>x.product===product&&x.calibre===calibre&&x.date===date);
    const signature=matching.map(x=>`${x.amount}|${x.lines}|${x.shifts}|${x.downtime}`).join(";")||"MODEL";
    const cacheKey=`${product}|${calibre}|${date}|${signature}`;
    if(dailySampleCache.has(cacheKey)) return dailySampleCache.get(cacheKey);
    let samples;
    if(matching.length){
      samples=emptySamples();
      matching.forEach((entry,index)=>{
        const resource=Math.min(1,entry.lines/2)*Math.min(1,entry.shifts/2);
        const net=Math.max(0,1-entry.downtime/Math.max(420*entry.shifts,1));
        const expected=entry.amount*resource*net;
        const part=ModelEngine.sampleRuns([expected*.9,expected,expected*1.1],`${cacheKey}|${index}`,simulationCount);
        samples=samples.map((value,run)=>value+part[run]);
      });
    }else{
      samples=ModelEngine.sampleRuns(calibreCapacity[product][calibre],cacheKey,simulationCount);
    }
    dailySampleCache.set(cacheKey,samples);
    return samples;
  };
  const earliestLowRiskDate=(order,currentSamples)=>{
    if(ModelEngine.probabilityAtLeast(currentSamples,order.rawDemand)>=state.thresholds.low) return null;
    let projected=currentSamples.map(value=>Math.min(order.rawDemand,value));
    const cursor=plusDays(dateValue(order.latest),1);
    for(let offset=1;offset<=90;offset++){
      if(cursor.getDay()!==0){
        const direct=dailySamples(order.product,order.calibre,iso(cursor));
        const protectedDailyCapacity=ModelEngine.quantile(direct,planningQuantile);
        projected=projected.map((value,run)=>Math.min(order.rawDemand,value+Math.min(direct[run],protectedDailyCapacity)*(1+flexLimit)));
      }
      const probability=ModelEngine.probabilityAtLeast(projected,order.rawDemand);
      if(probability>=state.thresholds.low) return {date:iso(cursor),probability,delayDays:Math.round((cursor-dateValue(order.planned))/86400000)};
      cursor.setDate(cursor.getDate()+1);
    }
    return null;
  };

  // Korumalı üretim görünümünde tüm uygun kaynakları ve siparişleri tek ağda birlikte optimize et.
  const requiredCombinations=new Map();
  orders.forEach(order=>{
    requiredCombinations.set(`${order.product}|${order.calibre}`,{product:order.product,calibre:order.calibre});
    if(order.altAllowed&&calibreCapacity[order.product][order.altCalibre]) requiredCombinations.set(`${order.product}|${order.altCalibre}`,{product:order.product,calibre:order.altCalibre});
  });
  const maxLatest=orders.reduce((latest,order)=>order.latest>latest?order.latest:latest,analysisDate);
  const resources=[];
  const allProductionDates=productionDates(analysisDate,maxLatest);
  requiredCombinations.forEach(({product,calibre})=>{
    const relevantOrders=orders.filter(order=>order.product===product&&(order.calibre===calibre||(order.altAllowed&&order.altCalibre===calibre)));
    const boundaries=[...new Set(relevantOrders.flatMap(order=>[order.planned,order.latest]))].sort();
    const buckets=new Map(boundaries.map(boundary=>[boundary,emptySamples()]));
    allProductionDates.forEach(date=>{
      const boundary=boundaries.find(value=>value>=date);
      if(!boundary) return;
      const day=dailySamples(product,calibre,date),current=buckets.get(boundary);
      buckets.set(boundary,current.map((value,run)=>value+day[run]));
    });
    buckets.forEach((samples,date)=>{
      const p50=ModelEngine.quantile(samples,.5);
      const protectedCapacity=ModelEngine.quantile(samples,planningQuantile);
      if(protectedCapacity<=0) return;
      resources.push({id:`NORMAL|${product}|${calibre}|${date}`,type:"normal",product,calibre,date,capacity:protectedCapacity,expectedCapacity:p50,samples});
      if(flexLimit>0) resources.push({id:`EXTRA|${product}|${calibre}|${date}`,type:"extra",product,calibre,date,capacity:protectedCapacity*flexLimit,expectedCapacity:p50*flexLimit,samples:samples.map(value=>value*flexLimit)});
    });
  });
  stocks.forEach((stock,index)=>{
    const shelfDays=stock.product==="LEVREK"?3:2;
    resources.push({id:`STOCK|${index}|${stock.lot}`,type:"stock",product:stock.product,calibre:stock.calibre,date:stock.date,expiry:iso(plusDays(dateValue(stock.date),shelfDays)),capacity:stock.amount,status:stock.status,reservedFor:stock.reservedFor,facility:stock.facility,lot:stock.lot});
  });

  const simulateFixedPlan=(planResources,planOrders,plan)=>{
    const allocationsByResource=new Map();
    plan.allocations.forEach(allocation=>{
      if(!allocationsByResource.has(allocation.resourceIndex)) allocationsByResource.set(allocation.resourceIndex,[]);
      allocationsByResource.get(allocation.resourceIndex).push(allocation);
    });
    allocationsByResource.forEach(items=>items.sort((a,b)=>b.benefit-a.benefit||a.orderIndex-b.orderIndex));
    const samplesByOrder=new Map(planOrders.map(order=>[order.index,emptySamples()]));
    for(let run=0;run<simulationCount;run++){
      const remainingOrders=new Map(planOrders.map(order=>[order.index,order.rawDemand]));
      planResources.forEach((resource,resourceIndex)=>{
        let available=resource.type==="stock"?resource.capacity:resource.samples[run];
        const planned=allocationsByResource.get(resourceIndex)||[];
        planned.forEach(allocation=>{
          const order=planOrders[allocation.orderIndex],remaining=remainingOrders.get(order.index)||0;
          const delivered=Math.min(allocation.amount,available,remaining);
          if(delivered<=0) return;
          samplesByOrder.get(order.index)[run]+=delivered;
          remainingOrders.set(order.index,remaining-delivered);
          available-=delivered;
        });
      });
    }
    return samplesByOrder;
  };

  // Ön risk planında tarih erteleme, alternatif kalibre ve ilave kapasite kapalıdır.
  const baselineOrders=orders.map(order=>({...order,deliveryFlexible:false,latest:order.planned,altAllowed:false,altCalibre:""}));
  const baselineResources=resources.filter(resource=>resource.type!=="extra");
  const baselineOptimized=OptimizationEngine.optimizeAllocation(baselineResources,baselineOrders);
  const baselineSamplesByOrder=simulateFixedPlan(baselineResources,baselineOrders,baselineOptimized);

  const optimized=OptimizationEngine.optimizeAllocation(resources,orders);
  const optimizedSamplesByOrder=simulateFixedPlan(resources,orders,optimized);

  const allocationsByOrder=new Map(orders.map(order=>[order.index,[]]));
  optimized.allocations.forEach(allocation=>allocationsByOrder.get(orders[allocation.orderIndex].index).push({...allocation,resource:resources[allocation.resourceIndex]}));
  const average=values=>values.reduce((sum,value)=>sum+value,0)/Math.max(values.length,1);
  const expectedShortage=(samples,order)=>average(samples.map(value=>Math.max(0,order.demand-Math.min(order.demand,value*order.yieldRate))));
  const computed=orders.map(order=>{
    const beforeRawSamples=baselineSamplesByOrder.get(order.index);
    const afterRawSamples=optimizedSamplesByOrder.get(order.index);
    const beforeDeliveredRaw=ModelEngine.summarize(beforeRawSamples),afterDeliveredRaw=ModelEngine.summarize(afterRawSamples);
    const beforeDelivered=beforeDeliveredRaw.map(value=>Math.min(order.demand,value*order.yieldRate));
    const afterDelivered=afterDeliveredRaw.map(value=>Math.min(order.demand,value*order.yieldRate));
    const preProb=ModelEngine.probabilityAtLeast(beforeRawSamples,order.rawDemand),postProb=ModelEngine.probabilityAtLeast(afterRawSamples,order.rawDemand);
    const beforeShort=expectedShortage(beforeRawSamples,order),afterShort=expectedShortage(afterRawSamples,order);
    const preRisk=riskFor(preProb),postRisk=riskFor(postProb),lineAllocations=allocationsByOrder.get(order.index);
    const stockRaw=lineAllocations.filter(item=>item.resource.type==="stock").reduce((sum,item)=>sum+item.amount,0);
    const flexKg=lineAllocations.filter(item=>item.resource.type==="extra").reduce((sum,item)=>sum+item.amount,0);
    const deliveryUsed=lineAllocations.some(item=>item.delayed&&item.amount>OptimizationEngine.EPSILON);
    const altUsed=lineAllocations.some(item=>item.alternative&&item.amount>OptimizationEngine.EPSILON);
    const safeDate=postProb<state.thresholds.low?earliestLowRiskDate(order,afterRawSamples):null;
    let recommendation="Kabul et";
    if(postProb<.5) recommendation=safeDate?`Teslimi ${safeDate.date} tarihine ertelemeyi değerlendir`:"Mevcut koşullarla kabul etme";
    else if(postProb<.8) recommendation=order.altAllowed&&!altUsed?"Alternatif kalibreyi değerlendir":safeDate?`Teslimi ${safeDate.date} tarihine ertelemeyi değerlendir`:"Miktar veya tarihi değiştir";
    else if(postProb<.95) recommendation=deliveryUsed?"En geç teslim tarihini kullan":safeDate?`Teslimi ${safeDate.date} tarihine ertelemeyi değerlendir`:flexKg>0?"İlave kapasiteyle kabul et":"Kontrollü kabul et";
    return {...order,stock:Math.min(order.demand,stockRaw*order.yieldRate),stockRaw,beforeDelivered,afterDelivered,beforeDeliveredRaw,afterDeliveredRaw,preProb,postProb,beforeShort,afterShort,preRisk,postRisk,recommendation,flexKg,deliveryUsed,altUsed,suggestedDate:safeDate?.date||"",suggestedDateProbability:safeDate?.probability||0,suggestedDelayDays:safeDate?.delayDays||0,refundBefore:beforeShort*order.price,refundAfter:afterShort*order.price,grossValue:order.demand*order.price};
  });

  computed.sort((a,b)=>a.index-b.index);
  const totalDemand=computed.reduce((s,x)=>s+x.demand,0),beforeFulfilled=computed.reduce((s,x)=>s+x.demand-x.beforeShort,0),afterFulfilled=computed.reduce((s,x)=>s+x.demand-x.afterShort,0);
  const fullBefore=computed.filter(x=>x.beforeDelivered[1]>=x.demand-.001).length,fullAfter=computed.filter(x=>x.afterDelivered[1]>=x.demand-.001).length;
  const refundByCurrency=currencyTotals(computed,"refundAfter"),refundBeforeByCurrency=currencyTotals(computed,"refundBefore"),grossByCurrency=currencyTotals(computed,"grossValue");
  const totalRawDemand=computed.reduce((s,x)=>s+x.rawDemand,0),fulfilledRaw=computed.reduce((s,x)=>s+x.afterDeliveredRaw[1],0);
  const risky=computed.filter(x=>x.postProb<.8).length,flexKg=computed.reduce((s,x)=>s+x.flexKg,0),stockKg=computed.reduce((s,x)=>s+x.stock,0),stockRawKg=computed.reduce((s,x)=>s+x.stockRaw,0);
  const normalCapacity=resources.filter(resource=>resource.type==="normal").reduce((sum,resource)=>sum+(resource.expectedCapacity||resource.capacity),0);
  const normalAllocated=optimized.allocations.filter(item=>resources[item.resourceIndex].type==="normal").reduce((sum,item)=>sum+item.amount,0);
  return {lines:computed,totalDemand,totalRawDemand,beforeFulfilled,afterFulfilled,fulfilledRaw,fullBefore,fullAfter,refundByCurrency,refundBeforeByCurrency,grossByCurrency,risky,flexKg,stockKg,stockRawKg,delayedLines:computed.filter(x=>x.deliveryUsed).length,alternativeLines:computed.filter(x=>x.altUsed).length,capacityUse:normalAllocated/Math.max(normalCapacity,1),simulationCount,optimizationMethod:"Korumalı min-maliyetli akış",optimizationObjective:optimized.objectiveValue,optimizedAllocationCount:optimized.allocations.length,planningQuantile};
}

function updateKpis(r){
  $("#kpi-demand").textContent=tonnes(r.totalDemand); $("#kpi-fulfilled").textContent=pct(r.afterFulfilled/r.totalDemand);
  $("#kpi-full-lines").textContent=`${r.fullAfter} / ${r.lines.length}`; $("#kpi-risky-lines").textContent=String(r.risky);
  $("#kpi-shortage").textContent=kg(r.totalDemand-r.afterFulfilled); $("#kpi-refund").textContent=currencySummary(r.refundByCurrency);
  $("#kpi-capacity").textContent=pct(r.capacityUse); $("#kpi-flex").textContent=kg(r.flexKg);
  $("#kpi-line-count").textContent=String(r.lines.length);
  const net=["TRY","EUR","USD"].reduce((out,c)=>{out[c]=Math.max(0,(r.grossByCurrency[c]||0)-(r.refundByCurrency[c]||0));return out;},{});
  $("#kpi-net-revenue").textContent=currencySummary(net); $("#kpi-stock-share").textContent=pct(r.stockKg/r.totalDemand);
  $("#kpi-production-share").textContent=pct(Math.max(0,r.afterFulfilled-r.stockKg)/r.totalDemand); $("#kpi-delayed-lines").textContent=String(r.delayedLines); $("#kpi-alternative-lines").textContent=String(r.alternativeLines);
  $("#kpi-context").textContent=`${$("#analysis-name").value} • optimizasyon sonrası değerler`;
}

function filters(){ return {customer:$("#filter-customer").value,market:$("#filter-market").value,product:$("#filter-product").value,calibre:$("#filter-calibre").value,risk:$("#filter-risk").value,currency:$("#filter-currency").value,start:$("#filter-start").value,end:$("#filter-end").value}; }
function filteredLines(lines){ const f=filters(); return lines.filter(x=>(!f.customer||x.customer===f.customer)&&(!f.market||x.market===f.market)&&(!f.product||x.product===f.product)&&(!f.calibre||x.calibre===f.calibre)&&(!f.risk||x.postRisk.label===f.risk)&&(!f.currency||x.currency===f.currency)&&(!f.start||x.planned>=f.start)&&(!f.end||x.planned<=f.end)); }

function renderResults(){
  const r=state.results;if(!r)return; const lines=filteredLines(r.lines);
  $("#empty-results").hidden=true;$("#results-content").hidden=false;
  const postService=r.fullAfter/r.lines.length; const banner=$("#decision-banner"); banner.className="decision-banner";
  let title="Plan uygulanabilir",text="Sipariş kalemleri mevcut stok ve kapasiteyle dengelenebilir.",chip="Kabul et";
  if(postService<.8){ title="Yüksek riskli kalemler bulunuyor";text="Miktar, teslim tarihi veya alternatif kalibre önerileri değerlendirilmelidir.";chip="Düzenleme gerekli";banner.classList.add("danger"); }
  else if(postService<.95){ title="Kontrollü düzenleme gerekli";text="Bazı kalemlerde teslim tarihi veya ilave kapasite desteği önerilmektedir.";chip="Kontrollü risk";banner.classList.add("warning"); }
  $("#decision-title").textContent=title;$("#decision-text").textContent=text;$("#decision-action").textContent=chip;$("#decision-action").disabled=false;$("#decision-action").dataset.action=postService>=.95?"accept":postService>=.8?"review":"revise";$("#decision-confirmation").hidden=true;
  const compare=[
    ["Tam karşılanan kalem",`${r.fullBefore}/${r.lines.length}`,`${r.fullAfter}/${r.lines.length}`,r.fullAfter-r.fullBefore," kalem"],
    ["Karşılanan miktar",pct(r.beforeFulfilled/r.totalDemand),pct(r.afterFulfilled/r.totalDemand),(r.afterFulfilled-r.beforeFulfilled)/r.totalDemand," puan"],
    ["Eksik miktar",kg(r.totalDemand-r.beforeFulfilled),kg(r.totalDemand-r.afterFulfilled),r.beforeFulfilled-r.afterFulfilled," kg"],
    ["İade tutarı",currencySummary(r.refundBeforeByCurrency),currencySummary(r.refundByCurrency),0,""],
    ["İlave kapasite","0 kg",kg(r.flexKg),-r.flexKg," kg"]
  ];
  $("#comparison-grid").innerHTML=compare.map((c,i)=>`<article class="compare-card"><span>${c[0]}</span><div class="compare-values"><del>${c[1]}</del><b>→ ${c[2]}</b></div><small class="${c[3]<0?"negative":""}">${i===1?`${nf1.format(Math.abs(c[3])*100)} yüzde puan`:i===0?`${c[3]>=0?"+":""}${nf0.format(c[3])}${c[4]}`:i===3?`Azalma: ${currencySummary(currencyDifference(r.refundBeforeByCurrency,r.refundByCurrency))}`:i===4?"Gerekli esneklik":`${c[3]>=0?"−":"+"}${nf0.format(Math.abs(c[3]))}${c[4]}`}</small></article>`).join("");
  $("#result-lines").innerHTML=lines.length?lines.map(x=>`<tr><td><strong>${x.orderId} / ${x.lineId}</strong><small>${x.customer} • ${x.market}</small></td><td><strong>${x.product==="LEVREK"?"Levrek":"Çipura"} ${x.commercialCalibre}</strong><small>${processingLabels[x.form]} • ham kalibre ${x.calibre}</small><small>${x.planned} → ${x.latest}</small></td><td>${kg(x.demand)}<small>${x.form!=="WHOLE"?`${kg(x.rawDemand)} bütün balık eşdeğeri • `:""}${money(x.price,x.currency)} / kg</small></td><td>${pct(x.beforeDelivered[1]/x.demand)}<small>${x.preRisk.label} risk</small></td><td class="delta-positive">${pct(x.afterDelivered[1]/x.demand)}<small>${x.afterDelivered[1]>x.beforeDelivered[1]?`+${kg(x.afterDelivered[1]-x.beforeDelivered[1])}`:"Değişmedi"}</small></td><td>${pct(x.postProb)}<small>Önce ${pct(x.preProb)}</small></td><td>${kg(x.afterShort)}<small>${money(x.refundAfter,x.currency)} iade</small></td><td><span class="risk-tag ${x.postRisk.className}">${x.postRisk.label}</span></td><td>${x.recommendation}${x.suggestedDate?`<small>Düşük risk eşiği: ${x.suggestedDate} • ${pct(x.suggestedDateProbability)}</small>`:""}<small>${x.altAllowed?`Alternatif: ${x.altCalibre}`:"Alternatif yok"}</small></td></tr>`).join(""):`<tr><td colspan="9">Seçili filtrelere uygun sonuç bulunamadı.</td></tr>`;
  renderRisk(r,lines); renderAllocation(r,lines); renderForecast(r,lines); renderFinancial(r,lines);
}

function renderRisk(r,lines){
  const source=lines.length?lines:r.lines; const worst=[...source].sort((a,b)=>a.postProb-b.postProb)[0];
  const byCalibre={};source.forEach(x=>{const k=`${x.product==="LEVREK"?"Levrek":"Çipura"} ${x.calibre}`;byCalibre[k]=(byCalibre[k]||0)+x.afterShort;});
  const riskyCalibre=Object.entries(byCalibre).sort((a,b)=>b[1]-a[1])[0]||["Risk oluşmadı",0];
  $("#risk-content").innerHTML=`<article class="insight-card"><span>En riskli kalem</span><strong>${worst?`${worst.orderId}/${worst.lineId}`:"—"}</strong><p>${worst?`${worst.customer} • tam olasılık ${pct(worst.postProb)}`:"Seçili sonuç yok"}</p>${worst?.suggestedDate?`<p>Tahmini en erken düşük risk tarihi: <b>${worst.suggestedDate}</b></p>`:""}</article><article class="insight-card"><span>En çok açık oluşturan kalibre</span><strong>${riskyCalibre[0]}</strong><p>${kg(riskyCalibre[1])} beklenen eksik miktar</p></article><article class="insight-card"><span>Ana risk nedeni</span><strong>${riskyCalibre[1]>0?"Kalibre bazlı arz–talep uyumsuzluğu":"Kritik risk oluşmadı"}</strong><p>Toplam tonaj yeterli olsa bile belirli kalibrelerde açık oluşabilir.</p></article>`;
}
function renderAllocation(r,lines){
  const source=lines.length?lines:r.lines,total=source.reduce((s,x)=>s+x.afterDeliveredRaw[1],0)||1,groups={};source.forEach(x=>{const key=`${x.customer} • ${x.product==="LEVREK"?"Levrek":"Çipura"} ${x.calibre}`;groups[key]=(groups[key]||0)+x.afterDeliveredRaw[1];});
  $("#allocation-content").innerHTML=`<div class="block-heading"><div><h3>Kapasitenin müşteri ve kalibrelere tahsisi</h3><p>Fileto ve temizlenmiş ürünler bütün balık eşdeğeriyle gösterilir. Kalan kapasite diğer müşteri taleplerine açıktır.</p></div><span>Toplam ${tonnes(total)} eşdeğer</span></div><div class="allocation-bars">${Object.entries(groups).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="allocation-item"><span>${k}</span><div class="bar-track"><i style="width:${v/total*100}%"></i></div><b>${tonnes(v)}</b></div>`).join("")}</div><div class="forecast-layout" style="margin-top:16px"><article class="forecast-card"><span>Stoktan karşılanan</span><strong>${tonnes(r.stockRawKg)}</strong><p>Bütün balık eşdeğeri olarak fiziksel stok.</p></article><article class="forecast-card"><span>Üretimden karşılanan</span><strong>${tonnes(Math.max(0,r.fulfilledRaw-r.stockRawKg))}</strong><p>Bütün balık eşdeğeri olarak hat kapasitesi.</p></article><article class="forecast-card"><span>İlave kapasite</span><strong>${tonnes(r.flexKg)}</strong><p>En fazla %12 sınırı içinde.</p></article></div>`;
}
function renderForecast(r,lines){
  const source=lines.length?lines:r.lines,avg=source.reduce((s,x)=>s+x.postProb,0)/Math.max(source.length,1);
  $("#forecast-content").innerHTML=`<div class="forecast-layout"><article class="forecast-card"><span>P10 • Temkinli üretim</span><strong>${tonnes(source.reduce((s,x)=>s+x.afterDeliveredRaw[0],0))}</strong><p>Bütün balık eşdeğeriyle düşük üretim bölgesi.</p></article><article class="forecast-card"><span>P50 • Medyan üretim</span><strong>${tonnes(source.reduce((s,x)=>s+x.afterDeliveredRaw[1],0))}</strong><p>Bütün balık eşdeğeriyle beklenen orta görünüm.</p></article><article class="forecast-card"><span>P90 • İyimser üretim</span><strong>${tonnes(source.reduce((s,x)=>s+x.afterDeliveredRaw[2],0))}</strong><p>Bütün balık eşdeğeriyle yüksek üretim bölgesi.</p></article><article class="forecast-card"><span>Ortalama tam karşılama olasılığı</span><strong>${pct(avg)}</strong><p>Kalem olasılıklarının basit ortalaması.</p></article><article class="forecast-card"><span>Model kaynağı</span><strong>GMM + Kernel</strong><p>Sentetik kalibre bazlı P10–P50–P90 parametreleri kullanılır.</p></article><article class="forecast-card"><span>Optimizasyon</span><strong>${r.optimizationMethod}</strong><p>${nf0.format(r.optimizedAllocationCount)} kaynak–sipariş tahsis kararı üretildi.</p></article><article class="forecast-card"><span>Risk testi</span><strong>${nf0.format(r.simulationCount)} koşu</strong><p>Her üretim günü tarayıcıda yeniden örneklenir ve sabit tahsis planı tekrar sınanır.</p></article></div>`;
}
function renderFinancial(r,lines){
  const source=lines.length?lines:r.lines,currencies=["TRY","EUR","USD"];
  const reductions=currencyDifference(r.refundBeforeByCurrency,r.refundByCurrency);
  $("#financial-content").innerHTML=`<div class="financial-grid">${currencies.map(c=>{const items=source.filter(x=>x.currency===c),gross=items.reduce((s,x)=>s+x.demand*x.price,0),refund=items.reduce((s,x)=>s+x.refundAfter,0);return `<article class="financial-card"><span>${c} siparişleri</span><strong>${money(Math.max(0,gross-refund),c)}</strong><p>Brüt ${money(gross,c)} • iade ${money(refund,c)}</p></article>`}).join("")}<article class="financial-card"><span>Beklenen iade tutarı</span><strong>${currencySummary(r.refundByCurrency)}</strong><p>Para birimleri birbirine çevrilmeden ayrı gösterilir.</p></article><article class="financial-card"><span>Optimizasyonla azalan iade</span><strong>${currencySummary(reductions)}</strong><p>Ön risk planıyla para birimi bazında karşılaştırma.</p></article><article class="financial-card"><span>İlave kapasite maliyeti</span><strong>Hesaplanmadı</strong><p>Maliyet verisi olmadığı için tutar uydurulmamıştır.</p></article></div>`;
}

async function runAnalysis(){
  const checked=validateData(true); if(!checked.valid){ $("#validation-message").scrollIntoView({behavior:"smooth",block:"center"}); return; }
  $("#run-analysis").disabled=true; const start=performance.now(); $("#analysis-badge").className="status-badge running"; $("#analysis-badge").textContent="Çalışıyor";
  $("#analysis").scrollIntoView({behavior:"smooth",block:"start"});
  const messages=["Veriler doğrulanıyor…","Üretim ve kalibre tahminleri hazırlanıyor…","Mevcut kurallarla ön risk hesaplanıyor…","Doğrusal tahsis ağı çözülüyor…","Optimize edilmiş plan 1.000 koşuda yeniden sınanıyor…","KPI ve raporlar hazırlanıyor…"];
  for(let step=1;step<=6;step++){
    const card=$(`[data-step="${step}"]`); card.classList.add("active"); card.querySelector("b").textContent="Çalışıyor"; $("#analysis-status").textContent=messages[step-1]; $("#overall-progress").style.width=`${(step-1)/6*100}%`;
    await new Promise(resolve=>setTimeout(resolve,320)); card.classList.remove("active");card.classList.add("done");card.querySelector("b").textContent="Tamamlandı";card.querySelector("span").textContent="✓";$("#overall-progress").style.width=`${step/6*100}%`;
  }
  state.results=calculateResults(checked.orders,checked.stocks); updateKpis(state.results); renderResults();
  $("#analysis-badge").className="status-badge done";$("#analysis-badge").textContent="Tamamlandı";$("#analysis-status").textContent="Analiz, optimizasyon ve son risk testi tamamlandı.";
  $("#elapsed-time").textContent=`${nf1.format((performance.now()-start)/1000)} sn`;$("#meta-orders").textContent=`${new Set(checked.orders.map(o=>o.orderId)).size} sipariş`;$("#meta-lines").textContent=`${checked.orders.length} kalem`;$("#meta-stocks").textContent=`${checked.stocks.length} stok partisi`;
  $("#run-analysis").disabled=false; setTimeout(()=>$("#results").scrollIntoView({behavior:"smooth",block:"start"}),250);
}

const drawerContent={
  guide:{eyebrow:"UYGULAMA REHBERİ",title:"Sistem nasıl kullanılır?",html:`<p><strong>Tanıtım sürümü:</strong> Bu sayfadaki üretim, kapasite ve süre değerleri sentetiktir; gerçek bir işletmenin kayıtlarını temsil etmez.</p><p>Bu sistem sipariş, fiziksel stok ve üretim kapasitesini birlikte değerlendirerek kalem bazında karşılanma riskini, beklenen eksik miktarı ve iade tutarını hesaplar.</p><div class="guide-step"><strong>1. Yeni sipariş</strong>Siparişleri ve ürün–kalibre kalemlerini elle girin veya Excel/CSV dosyasından yükleyin. Yükleme planlarındaki bütün balık, fileto ve temizlenmiş ürün satırları otomatik tanınır. Dosyada bulunmayan müşteri, tarih ve fiyat bilgileri yükleme sonrasında tek seferde tamamlanır.</div><div class="guide-step"><strong>2. Ürün dönüşümü</strong>Tanıtım varsayımı olarak PBI %42, PBO %46 ve temizlenmiş/D&G %80 verimle bütün balık eşdeğerine çevrilir. Ticari sipariş kilogramı iade hesabında, bütün balık eşdeğeri ise stok ve kapasite hesabında kullanılır.</div><div class="guide-step"><strong>3. Stok ve kapasite</strong>Güncel stok partilerini girin. Üretim ve kapasite bilgileri boş bırakılırsa sistem sentetik GMM, kernel ve Monte Carlo parametrelerinden tahmin üretir.</div><div class="guide-step"><strong>4. Ön risk ve korumalı optimizasyon</strong>Önce siparişler optimizasyon uygulanmadan değerlendirilir. Ardından min-maliyetli akış modeli stok ve günlük kapasiteyi bütün siparişler arasında birlikte dağıtır. Varsayılan %95 düşük risk hedefinde plan, medyan yerine kapasitenin korumalı alt %5 sınırına göre kurulur; öncelik, FIFO/LIFO, rezervasyon, raf ömrü, teslim esnekliği, alternatif kalibre ve ilave kapasite kuralları uygulanır.</div><div class="guide-step"><strong>5. Optimizasyon sonrası risk testi</strong>Bulunan sabit tahsis planı 1.000 Monte Carlo koşusunda yeniden sınanır. Risk, beklenen eksik kg ve iade tutarı optimizasyon öncesi ve sonrası için yan yana gösterilir.</div><div class="guide-step"><strong>6. Karar ve raporlama</strong>Kabul et, düzenlemeyi incele veya sipariş koşullarını gözden geçir kararlarından biri sunulur. Düşük risk eşiğine ulaşmayan kalem için tahmini en erken uygun teslim tarihi de hesaplanır. Yönetici özetini PDF, girdileri ve kalem sonuçlarını Excel yedeği olarak alabilirsiniz.</div>`},
  "kpi-guide":{eyebrow:"KPI SÖZLÜĞÜ",title:"Göstergeler nasıl yorumlanır?",html:`${[["Toplam sipariş","Girilen bütün sipariş kalemlerinin kg toplamıdır."],["Beklenen karşılama","P50 üretim görünümünde tahsis edilebilen miktarın toplam talebe oranıdır."],["Tam karşılanan kalem","Talebinin %100'ü ayrılan sipariş satırıdır. Miktar toleransı yoktur."],["Riskli kalem","Tam karşılanma olasılığı %80'in altında kalan satırdır."],["Eksik miktar","Talep ile beklenen teslimat arasındaki kg farkıdır."],["İade tutarı","Eksik kg × kalemin birim fiyatıdır; para birimleri birbirine çevrilmeden gösterilir."],["Kapasite kullanımı","Siparişlere ayrılan hat çıktısının kullanılabilir kapasiteye oranıdır."],["İlave kapasite","Normal kapasiteyi aşan, tanıtım sürümünde en fazla %12 olan operasyonel esnekliktir."],["Sipariş kalemi","Her ürün–kalibre talebini temsil eden bağımsız sipariş satırıdır."],["Beklenen net gelir","Brüt sipariş değerinden beklenen iade tutarı çıkarılarak para birimi bazında hesaplanır."],["Stok katkısı","Toplam talebin fiziksel stoktan karşılanan bölümüdür."],["Üretim katkısı","Toplam talebin yeni hat çıkışından karşılanan bölümüdür."],["Tarih düzenleme önerisi","Teslim esnekliğinin karşılanma sonucunu iyileştirdiği kalem sayısıdır."],["Alternatif kalibre önerisi","İzin verilen alternatif kalibrenin sonucu iyileştirdiği kalem sayısıdır."]].map(x=>`<div class="kpi-definition"><strong>${x[0]}</strong>${x[1]}</div>`).join("")}`},
  terms:{eyebrow:"TERİMLER SÖZLÜĞÜ",title:"Modelde kullanılan terimler",html:`${[["Kalibre","Balığın gram cinsinden ağırlık aralığıdır; örneğin 400–600 g."],["P10","Temkinli tahmindir. Benzetim sonuçlarının yaklaşık %10'u bu değerin altında, %90'ı üzerindedir."],["P50","Medyan veya orta tahmindir. Sonuçların yarısı bu değerin altında, yarısı üzerindedir."],["P90","İyimser tahmindir. Benzetim sonuçlarının yaklaşık %90'ı bu değerin altında kalır."],["Korumalı kapasite","Optimizasyonun risk eşiğine göre kullandığı alt kapasite sınırıdır. Varsayılan %95 düşük risk hedefinde üretimin alt %5 sınırı esas alınır; böylece yalnızca medyan üretime güvenilmez."],["GMM","Gaussian Karışım Modelidir. Balıkların tek bir homojen grup yerine farklı büyüme özellikli gizli gruplardan oluşmasını modeller."],["Adaptif kernel","Hedef gramaja en yakın geçmiş hasatları daha yüksek ağırlıkla kullanan tahmin yöntemidir."],["Monte Carlo","Üretim ve kalibre belirsizliğini çok sayıda olası koşuyla tekrar tekrar deneyen benzetim yöntemidir."],["Min-maliyetli akış","Stok ve kapasite kaynaklarını sipariş taleplerine, tanımlı öncelik ve kullanım cezalarına göre en uygun biçimde bağlayan doğrusal optimizasyon yöntemidir."],["Bootstrap","Model karşılaştırmasının tesadüfi bir örneğe bağlı olup olmadığını yeniden örneklemeyle sınar."],["AIC / BIC","Modellerin uyumu ile karmaşıklığını birlikte karşılaştıran bilgi ölçütleridir; düşük değer tercih edilir."],["MAE","Tahmin ile gerçek değer arasındaki ortalama mutlak hatadır; düşük olması daha iyidir."],["Hellinger uzaklığı","İki olasılık dağılımının birbirine ne kadar benzediğini ölçer; sıfıra yaklaştıkça uyum artar."],["FIFO","İlk giren stok partisinin önce kullanılmasıdır."],["LIFO","En yeni uygun stok partisinin önce kullanılmasıdır."],["Tam karşılanma olasılığı","Bir sipariş kaleminin Monte Carlo koşularında kaç kez eksiksiz karşılandığını gösterir."],["İade tutarı","Eksik gönderilen kg ile kalemin birim fiyatının çarpımıdır."]].map(x=>`<div class="kpi-definition"><strong>${x[0]}</strong>${x[1]}</div>`).join("")}`},
  rules:{eyebrow:"KURAL AYARLARI",title:"Model kuralları ve eşikler",html:""},
  notes:{eyebrow:"NOTLAR",title:"Analiz notları",html:""},
  "saved-orders":{eyebrow:"KAYITLI SİPARİŞLER",title:"Bu cihazdaki sipariş kayıtları",html:"<p class=\"storage-note\">Kayıtlar bu bilgisayarın tarayıcısında tutulur. Kalıcı yedek ve başka bilgisayara aktarım için Excel yedeği alın.</p><div id=\"saved-orders-list\" class=\"saved-list\"></div>"}
};
function rulesHtml(){ return `<div class="rule-row"><strong>Tanıtım verisi</strong><small>Bu sürümdeki tüm üretim, kapasite, verim ve zaman değerleri sentetiktir.</small></div><div class="rule-row"><strong>Tam karşılama</strong><small>Bir kalem yalnızca miktarın %100'ü ayrılırsa tam karşılanmış sayılır. Miktar toleransı uygulanmaz.</small></div><div class="rule-row"><strong>Ürün dönüşümü</strong><small>Tanıtım varsayımı olarak fileto PBI %42, fileto PBO %46, temizlenmiş/D&G %80 verimle bütün balık eşdeğerine çevrilir. PBI/PBO ibaresi olmayan fileto PBI kabul edilir.</small></div><div class="rule-row"><strong>Kısmi teslimat ve iade</strong><small>Kısmi teslimata izin verilir. İade tutarı nihai ürünün eksik kilogramı ile birim fiyatı çarpılarak hesaplanır.</small></div><div class="rule-row"><strong>Teslim tarihi</strong><small>Model yalnızca planlanan tarih ile en geç kabul edilebilir tarih arasında öneri üretir.</small></div><div class="rule-row"><strong>Alternatif kalibre</strong><small>Yalnızca sipariş kaleminde izin verilmiş ve alternatif belirtilmişse kullanılır.</small></div><div class="rule-row"><strong>Stok sırası</strong><small>İç piyasa FIFO; ihracat mümkün olduğunca en yeni uygun stokla karşılanır. Ayrılmış fiziksel stok başka müşteriye dağıtılamaz.</small></div><div class="rule-row"><strong>Raf ömrü</strong><small>Tanıtım varsayımı: levrek 3, çipura 2 gün.</small></div><div class="rule-row"><strong>Çalışma düzeni</strong><small>Tanıtım varsayımı: 2 fiziksel hat, 2 vardiya, vardiya başına 420 dakika. Pazar üretim yapılmaz.</small></div><div class="rule-row"><strong>İlave kapasite</strong><small>Eksik balık veya kalibre yaratmaz; yalnızca mevcut arzın hattan geçirilmesini en fazla %12 artırır.</small><label style="margin-top:8px">Üst sınır (%)<input id="drawer-flex" type="number" min="0" max="12" step="0.1" value="${$("#flex-limit").value}"></label></div><h3>Risk eşikleri</h3><div class="general-fields" style="grid-template-columns:repeat(3,1fr)"><label>Düşük risk başlangıcı (%)<input id="rule-low" type="number" value="${state.thresholds.low*100}"></label><label>Orta risk başlangıcı (%)<input id="rule-medium" type="number" value="${state.thresholds.medium*100}"></label><label>Yüksek risk başlangıcı (%)<input id="rule-high" type="number" value="${state.thresholds.high*100}"></label></div><div class="drawer-actions"><button id="save-rules" class="button primary" type="button">Ayarları Kaydet</button></div>`; }
function notesHtml(){ return `<p>Analize ilişkin müşteri görüşmesi, teslim açıklaması veya operasyonel özel durumları kaydedin. Kalemlere özel notlar sipariş tablosundaki “Not” alanına yazılır.</p><textarea id="general-notes" placeholder="Genel analiz notları…">${state.notes}</textarea><div class="drawer-actions"><button id="save-notes" class="button primary" type="button">Notları Kaydet</button></div>`; }

const infoContent={
  filters:["Filtreler","Gösterilen sonuçları müşteri, ürün, kalibre, tarih, risk ve para birimine göre daraltır. Hesaplamayı yeniden çalıştırmaz; KPI ayrıntıları, tablolar ve grafikler seçime göre güncellenir."],
  "order-inputs":["Sipariş ve operasyon girdileri","Bu bölümde birden fazla sipariş kalemi, stok partisi ve isteğe bağlı üretim-kapasite kaydı eklenir. CSV, XLSX ve XLS dosyaları desteklenir; uygulamadaki şablon en güvenli sütun yapısını sağlar. Üretim ve kapasite bilgileri girilmezse demo sürümü sentetik model parametrelerinden tahmin üretir. Her alanın birimi başlığında gösterilir."],
  orders:["Sipariş alanları","Ürün biçimi bütün balık, temizlenmiş/D&G, fileto PBI veya fileto PBO olabilir. Fileto ve temizlenmiş ürünlerin bütün balık eşdeğeri otomatik hesaplanır. Planlanan teslim tarihi her zaman zorunludur. Teslim esnekliği “Hayır” ise en geç tarih alanı kapalıdır; alternatif kalibre yalnızca izin verildiğinde seçilebilir."],
  stocks:["Stok partileri","Her fiziksel parti ayrı girilir. Hiç stok girilmezse sistem kullanılabilir stoku 0 kg kabul eder. Müşteriye ayrılmış stok sadece ilgili müşteri veya sipariş için kullanılabilir. Serbest stoklar pazar ve raf ömrü kurallarına göre tahsis edilir."],
  "capacity-input":["Üretim ve kapasite girdileri","Bu alan isteğe bağlıdır. Boş bırakılırsa sentetik GMM, adaptif kernel ve Monte Carlo parametreleriyle tahmin üretilir."],
  "model-basis":["Sentetik operasyon temeli","Tanıtım sürümü 2 fiziksel hat, günde 2 vardiya ve vardiya başına 420 dakika varsayımıyla çalışır. Pazar günü üretim yapılmaz. Fileto ve temizlenmiş siparişler bütün balık eşdeğeri olarak kapasiteye eklenir. Bu değerler gerçek bir işletmeyi temsil etmez."],
  "line-results":["Kalem sonuçları","Karşılanma oranı kg bazlıdır; tam karşılanma olasılığı ise Monte Carlo koşularında kalemin eksiksiz tamamlanma sıklığıdır. Düşük risk eşiğine ulaşmayan kalemlerde sistem, mevcut planı koruyup sonraki üretim günlerini ekleyerek tahmini en erken %95 güvenli tarihi hesaplar. Bu tarih girilen en geç tarihi aşıyorsa müşteriyle görüşülecek öneridir; otomatik teslim kararı değildir."],
  production:["Üretim altyapısı","Ürün ve kalibre miktarları sentetik üretim, zaman etüdü ve olasılıksal tahmin parametreleriyle oluşturulur. Levrek–çipura oranı sabitlenmez; demo dağılımından üretilir."],
  methods:["Analitik yöntemler","P10 temkinli, P50 medyan, P90 iyimser üretim görünümüdür. GMM gizli büyüme gruplarını, kernel hedef gramaja yakın geçmiş kayıtları, Monte Carlo belirsizliği ve min-maliyetli akış modeli doğrusal tahsis kararlarını temsil eder. Optimizasyon, seçilen düşük risk eşiğinden türetilen korumalı alt kapasiteyle plan kurar ve planı 1.000 koşuda sınar."]
};

function openDrawer(key){
  const base=drawerContent[key]; if(!base)return; $("#drawer-eyebrow").textContent=base.eyebrow;$("#drawer-title").textContent=base.title;
  $("#drawer-content").innerHTML=key==="rules"?rulesHtml():key==="notes"?notesHtml():base.html;showDrawer();
  if(key==="rules") $("#save-rules").addEventListener("click",()=>{ const low=Number($("#rule-low").value)/100,medium=Number($("#rule-medium").value)/100,high=Number($("#rule-high").value)/100;if(low>medium&&medium>high&&high>=0){state.thresholds={low,medium,high};$("#flex-limit").value=Math.min(12,Math.max(0,Number($("#drawer-flex").value)));closeDrawer();if(state.results){state.results=calculateResults(readOrders(),readStocks());updateKpis(state.results);renderResults();}} });
  if(key==="notes") $("#save-notes").addEventListener("click",()=>{state.notes=$("#general-notes").value.trim();$("#notes-count").textContent=state.notes?"1":"0";closeDrawer();});
}
function openInfo(key){ const info=infoContent[key];if(!info)return;$("#drawer-eyebrow").textContent="BİLGİ";$("#drawer-title").textContent=info[0];$("#drawer-content").innerHTML=`<p>${info[1]}</p>`;showDrawer(); }
function showDrawer(){ $("#drawer-backdrop").hidden=false;requestAnimationFrame(()=>$("#drawer").classList.add("open"));$("#drawer").setAttribute("aria-hidden","false"); }
function closeDrawer(){ $("#drawer").classList.remove("open");$("#drawer").setAttribute("aria-hidden","true");setTimeout(()=>$("#drawer-backdrop").hidden=true,230); }

function openKpi(key){
  const labels={demand:["Toplam sipariş","Girilen bütün kalemlerin talep miktarıdır."],fulfilled:["Beklenen karşılama","Optimizasyon sonrası Monte Carlo koşularındaki ortalama karşılanan kg / toplam talep oranıdır."],"full-lines":["Tam karşılanan kalem","P50 görünümünde miktar toleransı olmadan %100 karşılanan satır sayısıdır."],"risky-lines":["Riskli kalem","Tam karşılanma olasılığı %80'in altında kalan kalemlerdir."],shortage:["Beklenen eksik miktar","Monte Carlo koşularındaki eksik kilogramların ortalamasıdır."],refund:["Beklenen iade tutarı","Beklenen eksik kg × birim fiyat. Para birimleri birbirine çevrilmeden ayrı gösterilir."],capacity:["Normal kapasite kullanımı","Optimize edilmiş planda tahsis edilen normal hat çıktısının kullanılabilir normal kapasiteye oranıdır."],flex:["İlave kapasite","Normal kapasiteyi aşan, tanıtım sürümünde en fazla %12 olan operasyonel esnekliktir."],"line-count":["Sipariş kalemi","Analize girilen bağımsız ürün–kalibre satırı sayısıdır."],"net-revenue":["Beklenen net gelir","Brüt sipariş değerinden beklenen iade tutarı çıkarılır."],"stock-share":["Stok katkısı","Toplam talebin fiziksel stok partilerinden karşılanan oranıdır."],"production-share":["Üretim katkısı","Toplam talebin normal ve ilave hat çıktısından karşılanan oranıdır."],"delayed-lines":["Tarih düzenleme önerisi","Teslim esnekliğinin karşılanma sonucunu iyileştirdiği kalem sayısıdır."],"alternative-lines":["Alternatif kalibre önerisi","İzin verilen alternatif kalibrenin sonucu iyileştirdiği kalem sayısıdır."]};
  const item=labels[key];$("#drawer-eyebrow").textContent="KPI AYRINTISI";$("#drawer-title").textContent=item[0];let comparison="<p>Analiz tamamlandığında optimizasyon öncesi ve sonrası değerler burada karşılaştırılır.</p>";
  if(state.results){const r=state.results;const net=["TRY","EUR","USD"].reduce((out,c)=>{out[c]=Math.max(0,(r.grossByCurrency[c]||0)-(r.refundByCurrency[c]||0));return out;},{});const values={demand:[tonnes(r.totalDemand),tonnes(r.totalDemand)],fulfilled:[pct(r.beforeFulfilled/r.totalDemand),pct(r.afterFulfilled/r.totalDemand)],"full-lines":[`${r.fullBefore}/${r.lines.length}`,`${r.fullAfter}/${r.lines.length}`],"risky-lines":["—",String(r.risky)],shortage:[kg(r.totalDemand-r.beforeFulfilled),kg(r.totalDemand-r.afterFulfilled)],refund:[currencySummary(r.refundBeforeByCurrency),currencySummary(r.refundByCurrency)],capacity:["—",pct(r.capacityUse)],flex:["0 kg",kg(r.flexKg)],"line-count":[String(r.lines.length),String(r.lines.length)],"net-revenue":["—",currencySummary(net)],"stock-share":["—",pct(r.stockKg/r.totalDemand)],"production-share":["—",pct(Math.max(0,r.afterFulfilled-r.stockKg)/r.totalDemand)],"delayed-lines":["0",String(r.delayedLines)],"alternative-lines":["0",String(r.alternativeLines)]}[key];comparison=`<div class="kpi-definition"><strong>Optimizasyon öncesi</strong>${values[0]}</div><div class="kpi-definition"><strong>Optimizasyon sonrası</strong>${values[1]}</div>`;}
  $("#drawer-content").innerHTML=`<p>${item[1]}</p>${comparison}`;showDrawer();
}

function renderCharts(){
  const max=Math.max(...monthlyProduction.map(x=>x[1]));$("#monthly-chart").innerHTML=monthlyProduction.map(x=>`<div class="month-column"><span>${nf1.format(x[1]/1000)}</span><i class="${x[2]?"":"forecast"}" style="height:${x[1]/max*145}px"></i><b>${x[0]}</b></div>`).join("");
  const cmax=Math.max(...leadingCalibres.map(x=>x[1]));$("#calibre-chart").innerHTML=leadingCalibres.map(x=>`<div class="calibre-row"><span>${x[0]}</span><div><i class="${x[2]}" style="width:${x[1]/cmax*100}%"></i></div><b>${nf0.format(x[1])}</b></div>`).join("");
}
function updateFilterOptions(){ const orders=readOrders();const customers=[...new Set(orders.map(x=>x.customer).filter(Boolean))];const current=$("#filter-customer").value;$("#filter-customer").innerHTML=`<option value="">Tümü</option>${customers.map(x=>`<option>${x}</option>`).join("")}`;$("#filter-customer").value=current;const all=[...new Set(Object.values(calibreCapacity).flatMap(x=>Object.keys(x)))];$("#filter-calibre").innerHTML=`<option value="">Tümü</option>${all.map(x=>`<option>${x}</option>`).join("")}`; }
function resetSteps(){ $$("#process-steps article").forEach((x,i)=>{x.className="";x.querySelector("span").textContent=i+1;x.querySelector("b").textContent="Bekliyor";});$("#overall-progress").style.width="0"; }

document.addEventListener("click",e=>{
  const drawer=e.target.closest("[data-drawer]");if(drawer)openDrawer(drawer.dataset.drawer);
  const info=e.target.closest("[data-info]");if(info)openInfo(info.dataset.info);
  const kpi=e.target.closest("[data-kpi]");if(kpi)openKpi(kpi.dataset.kpi);
});
$("#close-drawer").addEventListener("click",closeDrawer);$("#drawer-backdrop").addEventListener("click",closeDrawer);document.addEventListener("keydown",e=>{if(e.key==="Escape")closeDrawer();});
$("#add-order-line").addEventListener("click",()=>addOrderLine());$("#add-stock-line").addEventListener("click",()=>addStockLine());$("#add-capacity-line").addEventListener("click",()=>addCapacityLine());
$("#validate-data").addEventListener("click",()=>validateData(true));$("#run-analysis").addEventListener("click",()=>{resetSteps();runAnalysis();});
$("#decision-action").addEventListener("click",()=>{
  const action=$("#decision-action").dataset.action,box=$("#decision-confirmation");box.hidden=false;
  if(action==="accept"){box.innerHTML="<strong>Sipariş kararı onaylandı.</strong> Girdileri ve güncel analiz sonucunu saklamak için “Siparişi Kaydet” düğmesini kullanabilirsiniz.";$("#decision-action").textContent="Kabul edildi";$("#decision-action").disabled=true;}
  else if(action==="review"){box.innerHTML="<strong>Düzenleme gerektiren kalemler aşağıda gösteriliyor.</strong> Tarih, ilave kapasite ve alternatif kalibre önerilerini inceleyin.";$("#line-results").scrollIntoView({behavior:"smooth",block:"start"});}
  else{box.innerHTML="<strong>Sipariş koşullarını gözden geçirin.</strong> Yüksek riskli kalemlerin miktar, tarih veya kalibre bilgilerini düzenleyip analizi yeniden çalıştırın.";$("#new-order").scrollIntoView({behavior:"smooth",block:"start"});}
});
$$('.result-tabs button').forEach(btn=>btn.addEventListener("click",()=>{$$('.result-tabs button').forEach(x=>x.classList.remove("active"));$$('.tab-panel').forEach(x=>x.classList.remove("active"));btn.classList.add("active");$(`#${btn.dataset.tab}`).classList.add("active");}));
$$('.filter-grid input,.filter-grid select').forEach(el=>el.addEventListener("change",()=>{if(state.results)renderResults();}));
$("#clear-filters").addEventListener("click",()=>{$$('.filter-grid input,.filter-grid select').forEach(x=>x.value="");if(state.results)renderResults();});
// Dosya içe aktarma ve yerel sipariş kayıtları data-io.js içinde yönetilir.
$("#pdf-report").addEventListener("click",()=>window.print());
$("#excel-report").addEventListener("click",()=>{if(!state.results){openInfo("line-results");return;}if(typeof exportAnalysisWorkbook==="function")exportAnalysisWorkbook();});

$("#analysis-date").value=iso(today);$("#filter-start").value=iso(today);$("#filter-end").value=iso(plusDays(today,30));
addOrderLine({orderId:"DEMO-001",lineId:"1",customer:"Demo Müşterisi",market:"İç piyasa",product:"LEVREK",calibre:"400–600 g",demand:8500,price:240,currency:"TRY",planned:iso(plusDays(today,2)),deliveryFlex:"NO",latest:iso(plusDays(today,2)),priority:"1",altAllowed:"NO"});
renderCharts();updateFilterOptions();
