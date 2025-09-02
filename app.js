(function(){
  const KEY = "pg_appointments_v1";

  const $ = (sel)=>document.querySelector(sel);
  const $$ = (sel)=>Array.from(document.querySelectorAll(sel));

  // State
  let items = load();
  let editingId = null;

  // Elements
  const formEl = $("#form");
  const idEl = $("#id");
  const nameEl = $("#name");
  const phoneEl = $("#phone");
  const petEl = $("#pet");
  const serviceEl = $("#service");
  const dtEl = $("#datetime");
  const notesEl = $("#notes");
  const statusEl = $("#status");

  const qEl = $("#q");
  const fromEl = $("#from");
  const toEl = $("#to");
  const fstatusEl = $("#fstatus");
  const sortEl = $("#sort");

  const listEl = $("#list");
  const countEl = $("#count");

  $("#clear").addEventListener("click", clearForm);
  $("#export").addEventListener("click", onExport);
  $("#import").addEventListener("change", onImport);
  $("#deleteAll").addEventListener("click", onDeleteAll);
  $("#addToday").addEventListener("click", ()=>{
    const now = new Date();
    now.setSeconds(0,0);
    dtEl.value = toLocalInputValue(now);
    nameEl.focus();
  });

  // Filters listeners
  [qEl, fromEl, toEl, fstatusEl, sortEl].forEach(el=> el.addEventListener("input", render));

  // Submit
  formEl.addEventListener("submit", (e)=>{
    e.preventDefault();
    const payload = {
      id: editingId || Date.now(),
      name: nameEl.value.trim(),
      phone: phoneEl.value.trim(),
      pet: petEl.value.trim(),
      service: serviceEl.value.trim(),
      datetime: dtEl.value,
      notes: notesEl.value.trim(),
      status: statusEl.value
    };
    if(!payload.name || !payload.phone || !payload.datetime){
      alert("Συμπλήρωσε Όνομα, Τηλέφωνο και Ημερομηνία/Ώρα.");
      return;
    }
    if(editingId){
      items = items.map(x => x.id===editingId ? payload : x);
    } else {
      items.push(payload);
    }
    save(); clearForm(); render();
  });

  function clearForm(){
    editingId = null;
    idEl.value = "";
    formEl.reset();
  }

  function onExport(){
    const blob = new Blob([JSON.stringify(items,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `appointments-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImport(e){
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const data = JSON.parse(reader.result);
        if(!Array.isArray(data)) throw new Error("Μη έγκυρο αρχείο");
        // Merge by id (update existing, add new)
        const byId = Object.fromEntries(items.map(x=>[x.id,x]));
        data.forEach(rec=>{ byId[rec.id] = rec; });
        items = Object.values(byId);
        save(); render();
        alert("Η εισαγωγή ολοκληρώθηκε!");
      }catch(err){
        alert("Σφάλμα στην εισαγωγή: " + err.message);
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  }

  function onDeleteAll(){
    if(confirm("Σίγουρα θέλεις να διαγράψεις ΟΛΑ τα ραντεβού; Η ενέργεια δεν αναιρείται.")){
      items = [];
      save(); render();
    }
  }

  function save(){
    localStorage.setItem(KEY, JSON.stringify(items));
  }
  function load(){
    try{
      return JSON.parse(localStorage.getItem(KEY)) || [];
    }catch{ return []; }
  }

  function toLocalDisplay(dtStr){
    if(!dtStr) return "";
    const d = new Date(dtStr);
    if (isNaN(d)) return dtStr;
    return d.toLocaleString([], { dateStyle: "short", timeStyle: "short" });
  }

  function toLocalInputValue(d){
    const pad = (n)=>String(n).padStart(2,"0");
    const yyyy=d.getFullYear();
    const mm=pad(d.getMonth()+1);
    const dd=pad(d.getDate());
    const hh=pad(d.getHours());
    const mi=pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function render(){
    // Filter
    const q = qEl.value.trim().toLowerCase();
    const from = fromEl.value ? new Date(fromEl.value+"T00:00") : null;
    const to = toEl.value ? new Date(toEl.value+"T23:59") : null;
    const fstatus = fstatusEl.value;

    let rows = items.filter(x => {
      const hay = (x.name+" "+x.phone+" "+x.pet+" "+x.service).toLowerCase();
      if(q && !hay.includes(q)) return false;
      const d = x.datetime ? new Date(x.datetime) : null;
      if(from && d && d < from) return false;
      if(to && d && d > to) return false;
      if(fstatus && x.status !== fstatus) return false;
      return true;
    });

    // Sort
    const sort = sortEl.value;
    rows.sort((a,b)=>{
      if(sort==="name") return a.name.localeCompare(b.name, "el");
      const da = new Date(a.datetime || 0).getTime();
      const db = new Date(b.datetime || 0).getTime();
      return sort==="desc" ? (db-da) : (da-db);
    });

    countEl.textContent = `${rows.length} ραντεβού (${items.length} συνολικά)`;

    // Render
    listEl.innerHTML = "";
    if(rows.length===0){
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "Δεν βρέθηκαν ραντεβού. Δοκίμασε διαφορετική αναζήτηση ή πρόσθεσε νέο.";
      listEl.appendChild(p);
      return;
    }

    rows.forEach(x=>{
      const card = document.createElement("div");
      card.className = "card-item";

      const top = document.createElement("div");
      const name = document.createElement("div");
      name.innerHTML = `<strong>${escapeHtml(x.name)}</strong> — <span class="small">${escapeHtml(x.phone)}</span>`;
      top.appendChild(name);

      const when = document.createElement("div");
      when.innerHTML = `🕒 ${toLocalDisplay(x.datetime)}`;
      top.appendChild(when);

      const badge = document.createElement("span");
      badge.className = "badge " + (x.status||"scheduled");
      badge.textContent = statusText(x.status);
      top.appendChild(badge);

      card.appendChild(top);
      card.appendChild(document.createElement("hr"));

      const body = document.createElement("div");
      body.innerHTML = `🐾 ${escapeHtml(x.pet || "-")}<br>🛁 ${escapeHtml(x.service || "-")}<br>📝 ${escapeHtml(x.notes || "-")}`;
      card.appendChild(body);

      const actions = document.createElement("div");
      actions.className = "item-actions";

      const btnDone = document.createElement("button");
      btnDone.className = "secondary";
      btnDone.textContent = "✔ Ολοκληρώθηκε";
      btnDone.addEventListener("click", ()=>updateStatus(x.id, "done"));

      const btnNoShow = document.createElement("button");
      btnNoShow.className = "secondary";
      btnNoShow.textContent = "🙈 No-show";
      btnNoShow.addEventListener("click", ()=>updateStatus(x.id, "no_show"));

      const btnEdit = document.createElement("button");
      btnEdit.className = "primary";
      btnEdit.textContent = "✏ Επεξεργασία";
      btnEdit.addEventListener("click", ()=>editItem(x.id));

      const btnDel = document.createElement("button");
      btnDel.className = "danger";
      btnDel.textContent = "🗑 Διαγραφή";
      btnDel.addEventListener("click", ()=>deleteItem(x.id));

      actions.append(btnDone, btnNoShow, btnEdit, btnDel);
      card.appendChild(actions);

      listEl.appendChild(card);
    });
  }

  function statusText(s){
    return ({
      scheduled: "Προγραμματισμένο",
      done: "Ολοκληρώθηκε",
      no_show: "Δεν εμφανίστηκε",
      cancelled: "Ακυρώθηκε"
    })[s||"scheduled"];
  }

  function updateStatus(id, s){
    items = items.map(x=> x.id===id ? {...x, status:s} : x);
    save(); render();
  }

  function editItem(id){
    const x = items.find(i=>i.id===id);
    if(!x) return;
    editingId = id;
    idEl.value = id;
    nameEl.value = x.name || "";
    phoneEl.value = x.phone || "";
    petEl.value = x.pet || "";
    serviceEl.value = x.service || "";
    dtEl.value = x.datetime || "";
    notesEl.value = x.notes || "";
    statusEl.value = x.status || "scheduled";
    window.scrollTo({top:0, behavior:"smooth"});
    nameEl.focus();
  }

  function deleteItem(id){
    if(!confirm("Να διαγραφεί το ραντεβού;")) return;
    items = items.filter(x=>x.id!==id);
    save(); render();
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"]/g, (c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
  }

  // Initial render
  render();
})();