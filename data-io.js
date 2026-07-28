const SAVED_ORDERS_KEY = "b2b_saved_orders_v1";

const importSchemas = {
  orders: {
    sheetHints: ["siparis", "orders", "order", "loading", "yukleme"],
    aliases: {
      orderId: ["siparis", "siparis no", "siparis numarasi", "order id", "order_id", "order no"],
      lineId: ["kalem", "kalem no", "kalem numarasi", "satir", "line id", "line_id"],
      customer: ["musteri", "musteri adi", "customer", "alici", "buyer"],
      market: ["pazar", "market", "ic piyasa ihracat", "demand market"],
      product: ["urun", "balik", "balik cinsi", "balik turu", "product", "species"],
      form: ["urun bicimi", "urun formu", "kesim sekli", "processing form", "product form"],
      calibre: ["kalibre", "model kalibre", "model_calibre", "istenen kalibre", "requested_calibre", "boy", "gramaj"],
      commercialCalibre: ["siparis kalibresi", "cikan kalibre", "fileto kalibresi", "commercial calibre", "output calibre"],
      demand: ["miktar", "miktar kg", "talep", "talep kg", "demand", "demand_kg", "quantity", "kg"],
      price: ["birim fiyat", "fiyat", "unit price", "unit_price", "price"],
      currency: ["para birimi", "doviz", "currency", "penalty_currency"],
      planned: ["teslim tarihi", "planlanan teslim tarihi", "delivery date", "delivery_date", "termin", "termin tarihi"],
      deliveryFlex: ["teslim esnekligi", "teslim tarihi esnek mi", "delivery flexible", "delivery_flexible"],
      latest: ["en gec teslim tarihi", "son teslim tarihi", "latest date", "latest_date"],
      priority: ["oncelik", "priority", "priority_rank"],
      altAllowed: ["alternatif kalibre izni", "alternatif izin", "calibre tolerance allowed", "calibre_tolerance_allowed"],
      altCalibre: ["alternatif kalibre", "alternative calibre", "alternative_calibre"],
      note: ["not", "aciklama", "note", "description"]
    },
    required: ["customer", "product", "demand", "planned"],
    requiredOneOf: [["calibre", "commercialCalibre"]]
  },
  stocks: {
    sheetHints: ["stok", "stock", "depo", "inventory"],
    aliases: {
      lot: ["parti", "parti no", "lot", "lot id", "lot_id", "snapshot id", "snapshot_id"],
      facility: ["tesis", "facility", "depo", "location"],
      product: ["urun", "balik", "balik cinsi", "balik turu", "product", "species"],
      calibre: ["kalibre", "boy", "gramaj", "calibre"],
      amount: ["miktar", "miktar kg", "stok kg", "kg", "amount", "quantity"],
      date: ["uretim tarihi", "giris tarihi", "uretim giris tarihi", "stok tarihi", "tarih", "date", "production date"],
      status: ["durum", "stok durumu", "stok_durumu", "status"],
      reservedFor: ["ayrildigi musteri", "ayrildigi siparis", "musteri siparis", "reserved for", "reserved_for"]
    },
    required: ["product", "calibre", "amount"]
  },
  capacities: {
    sheetHints: ["kapasite", "capacity", "uretim", "production"],
    aliases: {
      date: ["tarih", "uretim tarihi", "date", "production date"],
      product: ["urun", "balik", "balik turu", "product", "species"],
      calibre: ["kalibre", "boy", "gramaj", "calibre"],
      amount: ["beklenen uretim", "beklenen uretim kg", "uretim kg", "hat cikisi kg", "hat_cikisi_kg", "miktar", "kg", "amount"],
      lines: ["kullanilabilir hat", "hat", "hat sayisi", "available lines", "available_lines"],
      shifts: ["vardiya", "vardiya sayisi", "available shifts", "available_shifts"],
      downtime: ["bilinen durus", "bilinen durus dk", "durus", "downtime", "downtime_min"]
    },
    required: ["date", "product", "calibre", "amount"]
  }
};

function normalizedKey(value) {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[character]);
}

function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let text = String(value ?? "").trim().replace(/\s/g, "").replace(/[^0-9,.-]/g, "");
  if (!text) return 0;
  if (text.includes(",") && text.includes(".")) text = text.replace(/\./g, "").replace(",", ".");
  else if (text.includes(",")) text = text.replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function toIsoDate(value) {
  if (!value && value !== 0) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return iso(value);
  if (typeof value === "number" && window.XLSX?.SSF?.parse_date_code) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2,"0")}-${String(parsed.d).padStart(2,"0")}`;
  }
  const text = String(value).trim();
  const dmy = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;
  const ymd = text.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2,"0")}-${ymd[3].padStart(2,"0")}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : iso(parsed);
}

function normalizeProduct(value) {
  const key = normalizedKey(value);
  if (key.includes("cipura") || key.includes("dorada") || key.includes("bream")) return "CIPURA";
  if (key.includes("levrek") || key.includes("lubina") || key.includes("bass")) return "LEVREK";
  return String(value ?? "").trim().toLocaleUpperCase("tr-TR");
}

function normalizeProcessingForm(value) {
  const key=normalizedKey(value);
  if(key.includes("pbo")) return "PBO";
  if(key.includes("pbi")||key.includes("fileto")) return "PBI";
  if(key.includes("temiz")||key.includes("d g")||key.includes("cleaned")) return "CLEANED";
  return "WHOLE";
}

function normalizeCalibre(product, value) {
  const options = Object.keys(calibreCapacity[product] || {});
  const numbers = String(value ?? "").match(/\d+(?:[.,]\d+)?/g)?.map(x => Number(x.replace(",", "."))) || [];
  if (!numbers.length) return options.includes(value) ? value : "";
  let low = numbers[0], high = numbers[1] ?? numbers[0];
  if (low === 400 && high === 450) return "400–600 g";
  const exact = options.find(option => {
    const limits = option.match(/\d+/g)?.map(Number) || [];
    return limits[0] === low && limits[1] === high;
  });
  if (exact) return exact;
  return options.find(option => {
    const limits = option.match(/\d+/g)?.map(Number) || [];
    return limits.length === 2 && low >= limits[0] && high <= limits[1];
  }) || "";
}

function normalizeMarket(value) {
  const key = normalizedKey(value);
  return key.includes("ic") || key.includes("domestic") || key.includes("yurt ici") ? "İç piyasa" : "İhracat";
}

function normalizeCurrency(value) {
  const key = normalizedKey(value);
  if (key.includes("usd") || String(value).includes("$")) return "USD";
  if (key.includes("eur") || String(value).includes("€")) return "EUR";
  return "TRY";
}

function normalizeYesNo(value) {
  const key = normalizedKey(value);
  return value === true || value === 1 || ["evet", "yes", "true", "1", "izinli"].includes(key) ? "YES" : "NO";
}

function normalizePriority(value) {
  const key = normalizedKey(value);
  if (key.includes("kritik") || key === "3") return "3";
  if (key.includes("yuksek") || key === "2") return "2";
  return "1";
}

function normalizeStatus(value) {
  const key = normalizedKey(value);
  return key.includes("ayril") || key.includes("reserved") || key.includes("musteri") ? "RESERVED" : "FREE";
}

function aliasLookup(schema) {
  const lookup = new Map();
  Object.entries(schema.aliases).forEach(([field, aliases]) => aliases.forEach(alias => lookup.set(normalizedKey(alias), field)));
  return lookup;
}

function findBestTable(workbook, schema) {
  const lookup = aliasLookup(schema);
  let best = null;
  workbook.SheetNames.forEach((sheetName, sheetIndex) => {
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {header:1, defval:"", raw:true, blankrows:false});
    matrix.slice(0, 35).forEach((row, rowIndex) => {
      const mapped = row.map(cell => lookup.get(normalizedKey(cell))).filter(Boolean);
      const unique = new Set(mapped);
      const requiredHits = schema.required.filter(field => unique.has(field)).length;
      const alternativeHits = (schema.requiredOneOf || []).filter(group => group.some(field => unique.has(field))).length;
      const hintBonus = schema.sheetHints.some(hint => normalizedKey(sheetName).includes(hint)) ? 1 : 0;
      const score = unique.size + (requiredHits + alternativeHits) * 2 + hintBonus;
      if (!best || score > best.score) best = {score, sheetName, sheetIndex, rowIndex, matrix, fields:unique};
    });
  });
  if (!best || best.score < Math.max(4, schema.required.length + 1)) throw new Error("Dosyada uygun sütun başlıkları bulunamadı. Lütfen uygulamadaki dosya şablonunu kullanın.");
  const header = best.matrix[best.rowIndex].map(cell => lookup.get(normalizedKey(cell)) || "");
  const missing = schema.required.filter(field => !header.includes(field));
  const missingAlternatives = (schema.requiredOneOf || []).filter(group => !group.some(field => header.includes(field)));
  if (missing.length || missingAlternatives.length) {
    const labels=[...missing,...missingAlternatives.map(group=>group.join(" veya "))];
    throw new Error(`Zorunlu sütunlar eksik: ${labels.join(", ")}.`);
  }
  const rows = best.matrix.slice(best.rowIndex + 1).map((row, index) => {
    const record = {_sourceRow:index + best.rowIndex + 2};
    header.forEach((field, column) => { if (field && record[field] === undefined) record[field] = row[column]; });
    return record;
  }).filter(record => Object.entries(record).some(([key,value]) => key !== "_sourceRow" && String(value ?? "").trim() !== ""));
  return {sheetName:best.sheetName, rows};
}

function rangeFromDescription(value) {
  const match=String(value||"").match(/(\d{2,4})\s*[\/\-\u2010\u2011\u2012\u2013\u2014]\s*(\d{2,4})/);
  return match ? [Number(match[1]),Number(match[2])] : [];
}

function filetoRawCalibre(product, description) {
  const [low,high]=rangeFromDescription(description);
  if (!low) return "";
  if (high<=85) return normalizeCalibre(product,"200-300");
  if (high<=105) return normalizeCalibre(product,"300-400");
  if (high<=150) return normalizeCalibre(product,"400-600");
  if (high<=190) return normalizeCalibre(product,"600-800");
  if (high<=230) return normalizeCalibre(product,"800-1000");
  if (high<=360) return normalizeCalibre(product,"1000-1500");
  return "";
}

function loadingPlanRows(workbook) {
  for (const sheetName of workbook.SheetNames) {
    const matrix=XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],{header:1,defval:"",raw:true,blankrows:false});
    const firstRows=matrix.slice(0,5).flat().map(normalizedKey);
    const looksLikePlan=firstRows.some(x=>x.includes("loading plan order"))&&firstRows.includes("total");
    if(!looksLikePlan) continue;
    const rows=[];
    matrix.slice(2).forEach((source,index)=>{
      const description=String(source[0]||"").trim(), demand=parseNumber(source[3]);
      const key=normalizedKey(description);
      if(!description||!(demand>0)||key.includes("stone bass")||key.includes("granyoz")) return;
      const product=normalizeProduct(description);
      if(product!=="LEVREK"&&product!=="CIPURA") return;
      let form="WHOLE";
      if(key.includes("fillet")) form=key.includes("pbo")?"PBO":"PBI";
      else if(key.includes("d g")||key.includes("cleaned")||key.includes("temiz")) form="CLEANED";
      const commercialRange=rangeFromDescription(description);
      const commercialCalibre=commercialRange.length?`${commercialRange[0]}–${commercialRange[1]} g`:"";
      const rawCalibre=form==="PBI"||form==="PBO"?filetoRawCalibre(product,description):normalizeCalibre(product,description);
      const base={
        _sourceRow:index+3,_fromImport:true,orderId:"",lineId:String(index+1),customer:"",market:"İhracat",
        product,form,commercialCalibre:commercialCalibre||rawCalibre,calibre:rawCalibre,demand,price:0,currency:"EUR",
        planned:"",deliveryFlex:"NO",latest:"",priority:"1",altAllowed:"NO",altCalibre:"",
        note:`Dosyadan: ${description}${form!=="WHOLE"?` • ${Math.round(processingYields[form]*100)}% verim`:""}`
      };
      if(form==="WHOLE"&&commercialRange[0]===1000&&commercialRange[1]===2000&&product==="LEVREK"){
        const p50a=calibreCapacity.LEVREK["1000–1500 g"][1],p50b=calibreCapacity.LEVREK["1500–2000 g"][1],sum=p50a+p50b;
        rows.push({...base,calibre:"1000–1500 g",commercialCalibre:"1000–2000 g",demand:demand*p50a/sum,note:`${base.note} • demo P50 oranıyla bölündü`});
        rows.push({...base,lineId:`${index+1}B`,calibre:"1500–2000 g",commercialCalibre:"1000–2000 g",demand:demand*p50b/sum,note:`${base.note} • demo P50 oranıyla bölündü`});
      } else rows.push(base);
    });
    if(rows.length) return {sheetName,rows,format:"loading-plan"};
  }
  return null;
}

async function readImportFile(file, schema, kind) {
  if (!window.XLSX) throw new Error("Excel okuma bileşeni yüklenemedi.");
  const extension = file.name.split(".").pop().toLocaleLowerCase("tr-TR");
  if (!["csv", "xlsx", "xls"].includes(extension)) throw new Error("Yalnızca CSV, XLSX ve XLS dosyaları desteklenir.");
  const bytes = await file.arrayBuffer();
  const workbook = XLSX.read(bytes, {type:"array", cellDates:true});
  try { return findBestTable(workbook, schema); }
  catch(error) {
    const special=kind==="orders"?loadingPlanRows(workbook):null;
    if(special) return special;
    throw error;
  }
}

function parseOrderRecord(record, index) {
  const product = normalizeProduct(record.product);
  const planned = toIsoDate(record.planned);
  const form=normalizeProcessingForm(record.form);
  const commercialCalibre=String(record.commercialCalibre||record.calibre||"").trim();
  const calibre=form==="PBI"||form==="PBO"
    ? filetoRawCalibre(product,commercialCalibre)
    : normalizeCalibre(product,record.calibre||commercialCalibre);
  return {
    orderId:String(record.orderId || `DOSYA-${String(index + 1).padStart(3,"0")}`).trim(),
    lineId:String(record.lineId || index + 1).trim(), customer:String(record.customer || "").trim(), market:normalizeMarket(record.market),
    product, form, commercialCalibre, calibre, demand:parseNumber(record.demand), price:parseNumber(record.price), currency:normalizeCurrency(record.currency),
    planned, deliveryFlex:normalizeYesNo(record.deliveryFlex), latest:toIsoDate(record.latest) || planned, priority:normalizePriority(record.priority),
    altAllowed:normalizeYesNo(record.altAllowed), altCalibre:normalizeCalibre(product, record.altCalibre), note:String(record.note || "").trim(), sourceRow:record._sourceRow, _fromImport:Boolean(record._fromImport)
  };
}

function parseStockRecord(record, index) {
  const product = normalizeProduct(record.product);
  let date = toIsoDate(record.date);
  const lot = String(record.lot || `DOSYA-LOT-${String(index + 1).padStart(3,"0")}`).trim();
  if (!date) {
    const compact = lot.match(/(20\d{2})(\d{2})(\d{2})/);
    if (compact) date = `${compact[1]}-${compact[2]}-${compact[3]}`;
  }
  const status = normalizeStatus(record.status);
  return {lot, facility:normalizedKey(record.facility).includes("tesis b") ? "Tesis B" : "Tesis A", product, calibre:normalizeCalibre(product,record.calibre), amount:parseNumber(record.amount), date, status, reservedFor:String(record.reservedFor || (status === "RESERVED" ? "Belirtilmemiş – kontrol edin" : "")).trim(), sourceRow:record._sourceRow};
}

function parseCapacityRecord(record) {
  const product = normalizeProduct(record.product);
  return {date:toIsoDate(record.date), product, calibre:normalizeCalibre(product,record.calibre), kg:parseNumber(record.amount), lines:Math.min(2,Math.max(0,parseNumber(record.lines) || 2)), shifts:Math.min(2,Math.max(0,parseNumber(record.shifts) || 2)), downtime:Math.max(0,parseNumber(record.downtime)), sourceRow:record._sourceRow};
}

function checkImportedRows(kind, rows) {
  const errors = [];
  rows.forEach(row => {
    if (!row.product || !calibreCapacity[row.product]) errors.push(`${row.sourceRow}. satırda ürün Levrek veya Çipura olmalıdır.`);
    if (!row.calibre) errors.push(`${row.sourceRow}. satırda ${row.form === "PBI" || row.form === "PBO" ? "fileto kalibresi ham balık kalibresine eşlenemedi" : "kalibre tanınamadı"}.`);
    const amount = kind === "orders" ? row.demand : kind === "stocks" ? row.amount : row.kg;
    if (!(amount > 0)) errors.push(`${row.sourceRow}. satırda miktar sıfırdan büyük olmalıdır.`);
    if (kind === "orders" && !row.customer) errors.push(`${row.sourceRow}. satırda müşteri eksik.`);
    if (kind === "orders" && !row.planned) errors.push(`${row.sourceRow}. satırda teslim tarihi eksik veya geçersiz.`);
    if (kind !== "orders" && !row.date) errors.push(`${row.sourceRow}. satırda tarih eksik veya geçersiz.`);
    if (kind === "stocks" && row.status === "RESERVED" && !row.reservedFor) errors.push(`${row.sourceRow}. satırdaki ayrılmış stok için müşteri veya sipariş eksik.`);
  });
  return errors;
}

function showIoMessage(message, type="success") {
  const box = $("#validation-message");
  box.className = `validation-message show ${type}`;
  box.innerHTML = message;
}

function clearCurrentResults() {
  state.results = null;
  $("#empty-results").hidden = false;
  $("#results-content").hidden = true;
  $("#kpi-context").textContent = "Girdiler değişti; analiz yeniden çalıştırılmalıdır.";
}

async function importFileToForm(input, kind) {
  const file = input.files?.[0];
  if (!file) return;
  showIoMessage(`<strong>${escapeHtml(file.name)} okunuyor…</strong>`, "success");
  try {
    const schema = importSchemas[kind];
    const parsed = await readImportFile(file, schema, kind);
    let rows;
    if (kind === "orders") rows = parsed.rows.map(parseOrderRecord);
    else if (kind === "stocks") rows = parsed.rows.map(parseStockRecord);
    else rows = parsed.rows.map(parseCapacityRecord);
    rows = rows.filter(row => row.product === "LEVREK" || row.product === "CIPURA");
    let errors = checkImportedRows(kind, rows);
    if(parsed.format==="loading-plan") errors=errors.filter(error=>!error.includes("müşteri eksik")&&!error.includes("teslim tarihi eksik"));
    if (errors.length) throw new Error(`${errors.slice(0,6).join(" ")}${errors.length>6?` Ayrıca ${errors.length-6} hata daha var.`:""}`);
    if (!rows.length) throw new Error("Dosyada aktarılabilecek veri satırı bulunamadı.");
    if (kind === "orders") { $("#order-lines").replaceChildren(); rows.forEach(addOrderLine); }
    else if (kind === "stocks") { $("#stock-lines").replaceChildren(); rows.forEach(addStockLine); }
    else { $("#capacity-lines").replaceChildren(); rows.forEach(addCapacityLine); $(".optional-input").open = true; }
    clearCurrentResults(); updateFilterOptions();
    if(parsed.format==="loading-plan"){
      $("#import-completion").hidden=false;
      $("#import-planned").value="";
      showIoMessage(`<strong>${escapeHtml(file.name)} okundu.</strong> ${rows.length} levrek–çipura satırı aktarıldı; fileto ve temizlenmiş ürünler otomatik olarak bütün balık eşdeğerine çevrildi. Analizden önce yukarıdaki ortak sipariş bilgilerini tamamlayın.`);
    } else {
      $("#import-completion").hidden=true;
      showIoMessage(`<strong>${escapeHtml(file.name)} başarıyla aktarıldı.</strong> “${escapeHtml(parsed.sheetName)}” sayfasından ${rows.length} satır alındı ve mevcut ${kind === "orders" ? "sipariş" : kind === "stocks" ? "stok" : "kapasite"} satırlarının yerine yazıldı.`);
    }
  } catch (error) {
    showIoMessage(`<strong>Dosya aktarılamadı.</strong> ${escapeHtml(error.message)}`, "error");
  } finally {
    input.value = "";
  }
}

$("#apply-import-metadata").addEventListener("click",()=>{
  const orderId=$("#import-order-id").value.trim(),customer=$("#import-customer").value.trim(),planned=$("#import-planned").value;
  const price=Number($("#import-price").value),currency=$("#import-currency").value,market=$("#import-market").value;
  const missing=[]; if(!orderId)missing.push("sipariş no");if(!customer)missing.push("müşteri");if(!planned)missing.push("teslim tarihi");
  if(missing.length){showIoMessage(`<strong>Ortak bilgiler eksik.</strong> ${missing.join(", ")} alanlarını doldurun.`,"error");return;}
  const imported=$$(".order-line[data-imported='true']");
  imported.forEach((row,index)=>{
    row.querySelector(".order-id").value=orderId;
    row.querySelector(".line-id").value=String(index+1);
    row.querySelector(".customer").value=customer;
    row.querySelector(".market").value=market;
    row.querySelector(".planned-date").value=planned;
    if(row.querySelector(".delivery-flex").value!=="YES") row.querySelector(".latest-date").value=planned;
    row.querySelector(".unit-price").value=Number.isFinite(price)?price:0;
    row.querySelector(".currency").value=currency;
  });
  $("#import-completion").hidden=true;
  updateFilterOptions();clearCurrentResults();
  showIoMessage(`<strong>Ortak bilgiler uygulandı.</strong> ${imported.length} sipariş kalemi veri kontrolüne hazır.`);
});

function getSavedOrders() {
  try { return JSON.parse(localStorage.getItem(SAVED_ORDERS_KEY) || "[]"); }
  catch { return []; }
}

function writeSavedOrders(records) {
  localStorage.setItem(SAVED_ORDERS_KEY, JSON.stringify(records));
  updateSavedOrdersCount();
}

function currentSnapshot(id) {
  return {
    id:id || (crypto.randomUUID ? crypto.randomUUID() : `kayit-${Date.now()}`),
    name:$("#analysis-name").value.trim() || "İsimsiz sipariş analizi", savedAt:new Date().toISOString(), analysisDate:$("#analysis-date").value,
    flexLimit:Number($("#flex-limit").value), orders:readOrders(), stocks:readStocks(), capacities:readCapacities(), notes:state.notes,
    thresholds:{...state.thresholds}, results:state.results
  };
}

function saveCurrentOrder() {
  const checked = validateData(true);
  if (!checked.valid) return;
  try {
    const records = getSavedOrders();
    const snapshot = currentSnapshot(state.currentSavedId);
    const index = records.findIndex(record => record.id === snapshot.id);
    if (index >= 0) records[index] = snapshot; else records.unshift(snapshot);
    writeSavedOrders(records);
    state.currentSavedId = snapshot.id;
    showIoMessage(`<strong>Sipariş kaydedildi.</strong> “${escapeHtml(snapshot.name)}” bu cihazdaki Kayıtlı Siparişler bölümüne eklendi. Kalıcı yedek için Excel dışa aktarımı kullanabilirsiniz.`);
  } catch {
    showIoMessage("<strong>Sipariş kaydedilemedi.</strong> Tarayıcı yerel depolamaya izin vermiyor. Excel yedeği alın.", "error");
  }
}

function loadSavedOrder(id) {
  const record = getSavedOrders().find(item => item.id === id);
  if (!record) return;
  $("#analysis-name").value = record.name || "Kayıtlı Sipariş";
  $("#analysis-date").value = record.analysisDate || iso(today);
  $("#flex-limit").value = Math.min(12,Math.max(0,Number(record.flexLimit) || 0));
  $("#order-lines").replaceChildren(); (record.orders || []).forEach(order => addOrderLine({...order,deliveryFlex:order.deliveryFlexible?"YES":"NO",altAllowed:order.altAllowed?"YES":"NO"}));
  if (!record.orders?.length) addOrderLine();
  $("#stock-lines").replaceChildren(); (record.stocks || []).forEach(addStockLine);
  $("#capacity-lines").replaceChildren(); (record.capacities || []).forEach(capacity => addCapacityLine({...capacity,kg:capacity.amount ?? capacity.kg}));
  const resultsCompatible=(record.results?.lines||[]).every(line=>line.rawDemand&&line.afterDeliveredRaw);
  state.notes = record.notes || ""; state.thresholds = record.thresholds || state.thresholds; state.results = resultsCompatible ? record.results : null; state.currentSavedId = record.id;
  updateFilterOptions();
  if (state.results) { updateKpis(state.results); renderResults(); } else clearCurrentResults();
  closeDrawer();
  showIoMessage(`<strong>Kayıt açıldı.</strong> “${escapeHtml(record.name)}” girdileri forma yüklendi.`);
  $("#new-order").scrollIntoView({behavior:"smooth",block:"start"});
}

function deleteSavedOrder(id) {
  const record = getSavedOrders().find(item => item.id === id);
  if (!record || !confirm(`“${record.name}” kaydını silmek istiyor musunuz?`)) return;
  writeSavedOrders(getSavedOrders().filter(item => item.id !== id));
  if (state.currentSavedId === id) state.currentSavedId = null;
  renderSavedOrders();
}

function updateSavedOrdersCount() {
  const count = getSavedOrders().length;
  if ($("#saved-orders-count")) $("#saved-orders-count").textContent = String(count);
}

function renderSavedOrders() {
  const list = $("#saved-orders-list");
  if (!list) return;
  const records = getSavedOrders();
  list.innerHTML = records.length ? records.map(record => {
    const orderCount = new Set((record.orders || []).map(order => order.orderId)).size;
    const lineCount = (record.orders || []).length;
    return `<article class="saved-order-card"><header><div><h3>${escapeHtml(record.name)}</h3><time>${new Date(record.savedAt).toLocaleString("tr-TR")}</time></div><span class="status-badge ${record.results?"done":"idle"}">${record.results?"Analizli":"Taslak"}</span></header><p>${orderCount} sipariş • ${lineCount} kalem • ${(record.stocks || []).length} stok partisi</p><div class="saved-order-actions"><button data-saved-action="open" data-id="${record.id}" type="button">Aç</button><button data-saved-action="export" data-id="${record.id}" type="button">Excel yedeği</button><button class="delete" data-saved-action="delete" data-id="${record.id}" type="button">Sil</button></div></article>`;
  }).join("") : `<div class="empty-saved">Henüz kayıtlı sipariş bulunmuyor.</div>`;
}

function worksheetFromOrders(orders) {
  return XLSX.utils.json_to_sheet((orders || []).map(order => ({
    "Sipariş No":order.orderId,"Kalem No":order.lineId,"Müşteri":order.customer,"Pazar":order.market,"Ürün":order.product === "LEVREK" ? "Levrek" : "Çipura","Ürün Biçimi":processingLabels[order.form]||"Bütün balık","Sipariş Kalibresi":order.commercialCalibre||order.calibre,"Ham Balık Kalibresi":order.calibre,"Sipariş Miktarı (kg)":order.demand,"Bütün Balık Eşdeğeri (kg)":Number((order.rawDemand||order.demand).toFixed(2)),"Verim Oranı (%)":Number(((order.yieldRate||1)*100).toFixed(0)),"Birim Fiyat":order.price,"Para Birimi":order.currency,"Planlanan Teslim Tarihi":order.planned,"Teslim Tarihi Esnek mi?":order.deliveryFlexible?"Evet":"Hayır","En Geç Teslim Tarihi":order.latest,"Öncelik":order.priority,"Alternatif Kalibre İzni":order.altAllowed?"Evet":"Hayır","Alternatif Kalibre":order.altCalibre,"Not":order.note
  })));
}

function worksheetFromStocks(stocks) {
  return XLSX.utils.json_to_sheet((stocks || []).map(stock => ({"Parti No":stock.lot,"Tesis":stock.facility,"Ürün":stock.product === "LEVREK" ? "Levrek" : "Çipura","Kalibre":stock.calibre,"Miktar (kg)":stock.amount,"Üretim-Giriş Tarihi":stock.date,"Stok Durumu":stock.status === "RESERVED" ? "Müşteriye ayrılmış" : "Serbest","Ayrıldığı Müşteri/Sipariş":stock.reservedFor})));
}

function worksheetFromCapacities(capacities) {
  return XLSX.utils.json_to_sheet((capacities || []).map(capacity => ({"Tarih":capacity.date,"Ürün":capacity.product === "LEVREK" ? "Levrek" : "Çipura","Kalibre":capacity.calibre,"Beklenen Üretim (kg)":capacity.amount ?? capacity.kg,"Kullanılabilir Hat":capacity.lines,"Vardiya":capacity.shifts,"Bilinen Duruş (dk)":capacity.downtime})));
}

function worksheetFromResults(results) {
  return XLSX.utils.json_to_sheet((results?.lines || []).map(line => ({"Sipariş No":line.orderId,"Kalem No":line.lineId,"Müşteri":line.customer,"Ürün":line.product === "LEVREK" ? "Levrek" : "Çipura","Ürün Biçimi":processingLabels[line.form]||"Bütün balık","Sipariş Kalibresi":line.commercialCalibre||line.calibre,"Ham Balık Kalibresi":line.calibre,"Talep (kg)":line.demand,"Bütün Balık Eşdeğeri (kg)":Number(line.rawDemand.toFixed(2)),"Optimizasyon Öncesi Karşılanan (kg)":Math.round(line.beforeDelivered[1]),"Optimizasyon Sonrası Karşılanan (kg)":Math.round(line.afterDelivered[1]),"Eksik (kg)":Math.round(line.afterShort),"Tam Karşılanma Olasılığı (%)":Number((line.postProb*100).toFixed(1)),"Risk":line.postRisk.label,"İade Tutarı":Number(line.refundAfter.toFixed(2)),"Para Birimi":line.currency,"Öneri":line.recommendation,"Tahmini En Erken Düşük Risk Tarihi":line.suggestedDate||"","Önerilen Tarihte Tam Karşılanma Olasılığı (%)":line.suggestedDate?Number((line.suggestedDateProbability*100).toFixed(1)):""})));
}

function exportSnapshotWorkbook(snapshot) {
  if (!window.XLSX) { showIoMessage("<strong>Excel yedeği oluşturulamadı.</strong> Excel bileşeni yüklenemedi.","error"); return; }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheetFromOrders(snapshot.orders), "Siparişler");
  XLSX.utils.book_append_sheet(workbook, worksheetFromStocks(snapshot.stocks), "Stoklar");
  XLSX.utils.book_append_sheet(workbook, worksheetFromCapacities(snapshot.capacities), "Kapasite");
  if (snapshot.results) XLSX.utils.book_append_sheet(workbook, worksheetFromResults(snapshot.results), "Analiz Sonuçları");
  const safeName = String(snapshot.name || "siparis-yedegi").replace(/[\\/:*?"<>|]+/g,"-").slice(0,70);
  XLSX.writeFile(workbook, `${safeName}.xlsx`);
}

function exportAnalysisWorkbook() {
  exportSnapshotWorkbook(currentSnapshot(state.currentSavedId));
}

function exportSavedOrder(id) {
  const record = getSavedOrders().find(item => item.id === id);
  if (record) exportSnapshotWorkbook(record);
}

$("#orders-file").addEventListener("change", event => importFileToForm(event.target,"orders"));
$("#stocks-file").addEventListener("change", event => importFileToForm(event.target,"stocks"));
$("#capacity-file").addEventListener("change", event => importFileToForm(event.target,"capacities"));
$("#save-order").addEventListener("click", saveCurrentOrder);

document.addEventListener("click", event => {
  if (event.target.closest('[data-drawer="saved-orders"]')) setTimeout(renderSavedOrders,0);
  const action = event.target.closest("[data-saved-action]");
  if (!action) return;
  const id = action.dataset.id;
  if (action.dataset.savedAction === "open") loadSavedOrder(id);
  if (action.dataset.savedAction === "export") exportSavedOrder(id);
  if (action.dataset.savedAction === "delete") deleteSavedOrder(id);
});

state.currentSavedId = null;
updateSavedOrdersCount();
