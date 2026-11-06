
/* Nihongo Study Deck V5.0 reliability layer.
   Keeps the seed dataset and the public V4 IDs intact; adds compatibility/migration,
   consistent backup/restore, explicit reset scopes, and guarded SRS/quiz behavior. */
(function(){
  'use strict';
  const APP_VERSION = '5.0.0';
  const V5_BACKUP_SCHEMA = 5;
  const V5_DATASET_SCHEMA = 5;
  const V5_MIGRATION_MARKER = 'nihongo_study_deck_v5_migration';
  const v5Store = {
    progress: STORAGE.progress,
    imported: STORAGE.imported,
    session: STORAGE.session,
    daily: STORAGE.daily,
    prefs: STORAGE.prefs,
    quizHistory: STORAGE.quizHistory,
    skills: V3_STORAGE.skills,
    dailyGoal: V3_STORAGE.goal,
    legacyQuiz: 'jvfc_quiz_v2'
  };
  const $5 = id => document.getElementById(id);
  const isPlainObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const cloneJSON = value => JSON.parse(JSON.stringify(value));
  const validSkillRecord = value => isPlainObject(value);
  const v5Status = (message, isError=false) => {
    try { setStatus(message, isError); } catch (_) { /* status node may not be ready */ }
  };

  function v5ReadRaw(key){
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function v5ReadJSON(key){
    const raw = v5ReadRaw(key);
    if (raw === null) return {exists:false, valid:false, value:null, raw:null};
    try { return {exists:true, valid:true, value:JSON.parse(raw), raw}; }
    catch (_) {
      try { localStorage.setItem(key + '_recovery_v5_' + Date.now(), raw); } catch (_) {}
      return {exists:true, valid:false, value:null, raw};
    }
  }
  function v5ObjectMerge(primary, secondary){
    const out = {};
    if (isPlainObject(secondary)) Object.assign(out, secondary);
    if (isPlainObject(primary)) Object.assign(out, primary);
    return out;
  }
  function v5MergeHistory(primary, secondary){
    const seen = new Set(); const out=[];
    for (const entry of [...(Array.isArray(secondary)?secondary:[]), ...(Array.isArray(primary)?primary:[])]) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      let signature;
      try { signature = JSON.stringify([entry.date || '',entry.type || '',entry.startedAt || '',entry.finishedAt || '',entry.total || 0,entry.correct || 0,entry.wrong || 0,entry.answers || []]); }
      catch (_) { signature = JSON.stringify(entry); }
      if (!seen.has(signature)) { seen.add(signature); out.push(entry); }
    }
    return out.slice(-500);
  }
  function v5MergeProgress(primary, secondary){
    const out={};
    if(isPlainObject(secondary))for(const [id,row] of Object.entries(secondary))if(isPlainObject(row))out[id]={...row};
    if(isPlainObject(primary))for(const [id,row] of Object.entries(primary)){
      if(!isPlainObject(row))continue;
      const old=out[id];
      const placeholder=row.status==='new' && !Number(row.reviewedAt||0) && !Number(row.repetitions||0) && !Number(row.quizAttempts||0) && !Number(row.quizCorrect||0) && !Number(row.mistakes||0) && !(Array.isArray(row.history)&&row.history.length);
      const meaningfulOld=isPlainObject(old) && (old.status && old.status!=='new' || Number(old.reviewedAt||0)>0 || Number(old.repetitions||0)>0 || Number(old.quizAttempts||0)>0 || Number(old.quizCorrect||0)>0 || Number(old.mistakes||0)>0 || (Array.isArray(old.history)&&old.history.length>0));
      if(placeholder&&meaningfulOld)out[id]={...row,...old,firstSeenAt:Number(old.firstSeenAt||row.firstSeenAt||0)};
      else out[id]={...(old||{}),...row};
    }
    return out;
  }
  function v5MergeDaily(primary, secondary){
    const out = {};
    for (const source of [secondary, primary]) {
      if (!isPlainObject(source)) continue;
      for (const [day,value] of Object.entries(source)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
        const n = Number(typeof value === 'object' && value ? value.reviews : value);
        if (Number.isFinite(n) && n >= 0) out[day] = Math.max(Number(out[day] || 0), n);
      }
    }
    return out;
  }
  function v5WordIdentity(word){
    return String(word?.japanese || '').trim() + '|' + String(word?.hiragana || '').trim();
  }
  function v5MergeImported(primary, secondary){
    const byKey = new Map();
    for (const w of [...(Array.isArray(secondary)?secondary:[]),...(Array.isArray(primary)?primary:[])]) {
      if (!isPlainObject(w) || typeof w.japanese !== 'string' || !w.japanese.trim() || typeof w.hiragana !== 'string' || !w.hiragana.trim()) continue;
      const key=v5WordIdentity(w);
      if (!byKey.has(key)) byKey.set(key, cloneJSON(w));
      else {
        const old=byKey.get(key);
        const cats=[...(Array.isArray(old.categories)?old.categories:[]),...(Array.isArray(w.categories)?w.categories:[])];
        old.categories=[...new Set(cats.filter(x=>typeof x==='string'))];
        const examples=[...(Array.isArray(old.examples)?old.examples:[]),...(Array.isArray(w.examples)?w.examples:[])];
        const sig=new Set(); old.examples=examples.filter(ex=>{if(!isPlainObject(ex)||typeof ex.japanese!=='string'||!ex.japanese.trim())return false;const s=[ex.japanese,ex.reading||'',ex.translation||'',ex.target||''].join('|');if(sig.has(s))return false;sig.add(s);return true;});
        for (const k of ['exampleJapanese','exampleReading','exampleMeaning','usageNotes','relatedWords','exampleValidationStatus']) if ((!old[k] || (Array.isArray(old[k]) && !old[k].length)) && w[k]) old[k]=cloneJSON(w[k]);
      }
    }
    const seedKeys = new Set(SEED.map(v5WordIdentity));
    return [...byKey.entries()].filter(([key])=>!seedKeys.has(key)).map(([,w])=>w);
  }
  function v5MigrateLegacyKeys(){
    // Active V4 runtime used V2 preference/history keys; earlier V4 code also wrote V4-named keys.
    const alias = {
      progress: ['jvfc_progress_v2','jvfc_progress_v3','jvfc_progress_v4'],
      imported: ['jvfc_imported_v2','jvfc_imported_v3','jvfc_imported_v4'],
      session: ['jvfc_session_v2','jvfc_session_v3','jvfc_session_v4'],
      daily: ['jvfc_daily_v2','jvfc_daily_v3','jvfc_daily_v4'],
      prefs: ['jvfc_prefs_v4','jvfc_preferences_v1','jvfc_preferences_v3'],
      quizHistory: ['jvfc_quiz_history_v4','jvfc_quiz_history_v3','jvfc_quiz_history_v1'],
      skills: ['jvfc_skill_progress_v4'],
      dailyGoal: ['jvfc_daily_goal_v4']
    };
    const marker = v5ReadRaw(V5_MIGRATION_MARKER);
    // Run once after successful migration. This prevents a later user reset from being undone by stale aliases.
    if (marker !== null) return {moved:0,corrupt:0,previouslyMarked:true};
    let moved = 0, corrupt = 0;
    for (const [logical, keys] of Object.entries(alias)) {
      const activeKey = v5Store[logical];
      if (!activeKey) continue;
      const active = v5ReadJSON(activeKey);
      let merged = active.valid ? active.value : null;
      let found = false;
      for (const key of keys) {
        const legacy = v5ReadJSON(key);
        if (!legacy.exists) continue;
        if (!legacy.valid) { corrupt++; continue; }
        found = true;
        if (logical === 'progress') merged = v5MergeProgress(merged, legacy.value);
        else if (logical === 'skills') merged = v5ObjectMerge(merged, legacy.value);
        else if (logical === 'prefs') merged = v5ObjectMerge(merged, legacy.value);
        else if (logical === 'daily') merged = v5MergeDaily(merged, legacy.value);
        else if (logical === 'quizHistory') merged = v5MergeHistory(merged, legacy.value);
        else if (logical === 'imported') merged = v5MergeImported(merged, legacy.value);
        else if (logical === 'session') { if (!isPlainObject(merged) || !merged.id) merged=legacy.value; }
        else if (logical === 'dailyGoal') { if (merged == null) merged=legacy.value; }
      }
      if (found && merged !== null) {
        try { localStorage.setItem(activeKey, JSON.stringify(merged)); moved++; } catch (_) { /* keep live memory and report below */ }
      }
    }
    // Ambiguous `undefined` key was created by an earlier broken namespace expression. Never delete it.
    const ambiguous=v5ReadJSON('undefined');
    if (ambiguous.exists && ambiguous.valid) {
      if (Array.isArray(ambiguous.value)) {
        try { const activeHistory=v5ReadJSON(v5Store.quizHistory);quizHistory=v5MergeHistory(activeHistory.valid&&Array.isArray(activeHistory.value)?activeHistory.value:quizHistory,ambiguous.value); localStorage.setItem(v5Store.quizHistory,JSON.stringify(quizHistory)); } catch (_) {}
      } else if (isPlainObject(ambiguous.value)) {
        const keys=['theme','fontSize','sessionLimit','dailyNewLimit','v3DailyGoal','v3PracticeSkill'];
        if (keys.some(k=>Object.prototype.hasOwnProperty.call(ambiguous.value,k))) {
          const activePrefs=v5ReadJSON(v5Store.prefs);studyPrefs=v5ObjectMerge(activePrefs.valid&&isPlainObject(activePrefs.value)?activePrefs.value:studyPrefs,ambiguous.value);
          try { localStorage.setItem(v5Store.prefs,JSON.stringify(studyPrefs)); } catch (_) {}
        }
      }
    }
    try { localStorage.setItem(V5_MIGRATION_MARKER, JSON.stringify({schemaVersion:5,at:new Date().toISOString(),moved,corrupt,sourceVersion:'V4'})); } catch (_) {}
    return {moved,corrupt,previouslyMarked:!!marker};
  }

  // Centralized guarded storage API. Existing features continue to use save/safeRead by name.
  safeRead = function(key, fallback){
    const result=v5ReadJSON(key);
    if (!result.exists) return fallback;
    if (!result.valid) { v5Status('Data lokal rusak pada key ' + key + '. Salinan pemulihan dibuat bila browser mengizinkan.',true); return fallback; }
    return result.value;
  };
  save = function(key, value){
    try {
      const encoded=JSON.stringify(value);
      if (encoded === undefined) throw new Error('Data tidak dapat diserialisasi.');
      localStorage.setItem(key,encoded); return true;
    } catch(e) {
      v5Status('Gagal menyimpan data lokal (' + key + '). Browser mungkin menolak storage atau kapasitas penuh. Ekspor backup sebelum mengubah data lagi.',true);
      return false;
    }
  };

  // Migrate legacy keys into the exact keys used by the current V4 runtime, then hydrate live state.
  let v5StoragePersistent = false;
  try { const probe='__nihongo_study_deck_v5_probe__';localStorage.setItem(probe,'1');localStorage.removeItem(probe);v5StoragePersistent=true; } catch (_) { v5StoragePersistent=false; }
  const v5Migration = v5MigrateLegacyKeys();
  try {
    const savedProgress=safeRead(STORAGE.progress,{}); if(isPlainObject(savedProgress))progress=v5PlainProgress(v5MergeProgress(progress,savedProgress));
    const savedDaily=safeRead(STORAGE.daily,{}); if(isPlainObject(savedDaily))daily=v5MergeDaily(daily,savedDaily);
    const savedPrefs=safeRead(STORAGE.prefs,{}); if(isPlainObject(savedPrefs))studyPrefs=v5ObjectMerge(studyPrefs,savedPrefs);
    const savedHistory=safeRead(STORAGE.quizHistory,[]); if(Array.isArray(savedHistory))quizHistory=v5MergeHistory(quizHistory,savedHistory);
    const savedSkills=safeRead(V3_STORAGE.skills,{}); if(isPlainObject(savedSkills))v3SkillProgress=v5PlainSkills(v5ObjectMerge(v3SkillProgress,savedSkills));
    const savedImported=safeRead(STORAGE.imported,[]); if(Array.isArray(savedImported))imported=v5MergeImported(imported,savedImported);
    allWords=mergeDatasets(SEED,imported);
    fillCategoryOptions();
    save(STORAGE.progress,progress);save(STORAGE.daily,daily);save(STORAGE.prefs,studyPrefs);save(STORAGE.quizHistory,quizHistory);save(V3_STORAGE.skills,v3SkillProgress);save(STORAGE.imported,imported);
  } catch(e) { v5Status('Sebagian data lama belum dapat direkonsiliasi: '+(e.message||String(e)),true); }

  // Fix the review engine to maintain one overall SRS record and a separately identified skill record.
  rateCurrent = function(rating){
    const w=filteredWords[currentIndex];
    if(!w)return;
    if(!isBack){v5Status('Buka jawaban sebelum memberi penilaian. Melihat kartu tidak otomatis dihitung sebagai penguasaan.',true);return;}
    if(!['again','hard','good','easy'].includes(rating))return;
    const old=wordProgress(w),now=Date.now();
    let repetitions=Math.max(0,Number(old.repetitions)||0),interval=Math.max(0,Number(old.interval)||0),ease=Math.min(2.8,Math.max(1.3,Number(old.easeFactor)||2.5)),lapses=Math.max(0,Number(old.lapses)||0),status='learning';
    if(rating==='again'){repetitions=0;interval=10/1440;lapses++;ease=Math.max(1.3,ease-.2);status='again';}
    else if(rating==='hard'){repetitions=Math.max(1,repetitions+1);interval=old.repetitions===0?1:Math.max(1,Math.ceil((old.interval||1)*1.2));ease=Math.max(1.3,ease-.15);status='hard';}
    else if(rating==='good'){repetitions++;interval=old.repetitions===0?1:old.repetitions===1?6:Math.max(1,Math.round((old.interval||1)*ease));status='review';}
    else {repetitions++;interval=old.repetitions===0?4:Math.max(2,Math.round((old.interval||1)*ease*1.3));ease=Math.min(2.8,ease+.15);status='review';}
    if(rating!=='again'&&repetitions>=3&&interval>=7)status='mastered';
    const next={...old,status,interval,easeFactor:Math.round(ease*100)/100,dueAt:now+interval*86400000,repetitions,reviewedAt:now,firstSeenAt:old.firstSeenAt||now,lapses,history:[...(Array.isArray(old.history)?old.history:[]),{at:now,rating,interval}].slice(-30)};
    progress[w.id]=next;
    // Simpan progres utama lebih dahulu. Kegagalan penyimpanan statistik skill
    // tidak boleh menghentikan navigasi antrean review.
    save(STORAGE.progress,progress);
    try {
      if(typeof v3RecordSkillRating==='function')v3RecordSkillRating(w.id,$5('v3PracticeSkill')?.value||'overall',rating);
    } catch(skillError) {
      console.error('Gagal memperbarui statistik skill; review tetap dilanjutkan.', skillError);
    }
    try { recordDaily(); } catch(dailyError) {
      console.error('Gagal memperbarui statistik harian; review tetap dilanjutkan.', dailyError);
    }
    // Rating hanya memperbarui progres; jangan membangun ulang deck dari filter dinamis.
    // Snapshot filteredWords adalah antrean sesi aktif. Status SRS yang baru disimpan
    // dapat membuat kartu tidak lagi cocok dengan filter "due"/"again", sehingga
    // applyFilters(w.id) di sini sebelumnya mengembalikan posisi ke indeks 0.
    isBack=false;
    const nextIndex=currentIndex+1;
    if(nextIndex<filteredWords.length){
      currentIndex=nextIndex;
      renderCard();
    }else{
      // Akhiri sesi secara eksplisit; jangan wrap otomatis ke kartu pertama.
      filteredWords=[];
      currentIndex=0;
      renderCard();
      $('japaneseWord').textContent='Sesi review selesai';
      $('frontHint').textContent='Semua kartu dalam antrean sesi ini sudah diproses. Mulai sesi baru secara eksplisit jika ingin melanjutkan.';
      $('cardCountLabel').textContent='Sesi selesai';
      $('positionLabel').textContent='Selesai';
      $('reviewLabel').textContent='';
      $('sessionTotal').textContent='0 kartu tersisa';
      $('sessionProgress').style.width='100%';
      if($('cardFaceStatus'))$('cardFaceStatus').textContent='Sesi selesai.';
    }
    const label={again:'Again: jadwal ulang sekitar 10 menit',hard:`Hard: ulangi dalam ${Math.round(interval*100)/100} hari`,good:`Good: ulangi dalam ${interval} hari`,easy:`Easy: ulangi dalam ${interval} hari`}[rating];
    v5Status(label);renderStats();
  };

  function v5PlainProgress(progressValue){
    if(!isPlainObject(progressValue))throw new Error('Objek progres tidak valid.');
    const out={};
    for(const [id,value] of Object.entries(progressValue)){
      if(typeof id!=='string'||!id.trim()||!isPlainObject(value))continue;
      const p={...value};
      if(p.status!=null&&!['new','learning','review','hard','again','mastered'].includes(p.status))p.status='new';
      for(const k of ['interval','dueAt','repetitions','reviewedAt','firstSeenAt','easeFactor','mistakes','lapses','quizCorrect','quizAttempts']) if(p[k]!=null){const n=Number(p[k]);p[k]=Number.isFinite(n)&&n>=0?n:0;}
      if(p.history!=null&&!Array.isArray(p.history))p.history=[];
      out[id]=p;
    }
    return out;
  }
  function v5PlainSkills(value){
    if(!isPlainObject(value))throw new Error('Progres keterampilan tidak valid.');
    const out={};
    for(const [key,row] of Object.entries(value)){
      if(typeof key!=='string'||!key.includes('|')||!isPlainObject(row))continue;
      const clean={...row};
      for(const k of ['attempts','correct','mistakes','interval','dueAt','repetitions','lastAt']) if(clean[k]!=null){const n=Number(clean[k]);clean[k]=Number.isFinite(n)&&n>=0?n:0;}
      if(clean.history!=null&&!Array.isArray(clean.history))clean.history=[];
      out[key]=clean;
    }
    return out;
  }
  function v5NormalizeBackup(raw){
    if(!isPlainObject(raw))throw new Error('File backup harus berupa objek JSON.');
    // V5 portable backup format.
    if(raw.app==='Nihongo Study Deck' && isPlainObject(raw.data)){
      if(raw.kind!=='full-backup')throw new Error('Jenis file bukan full-backup; ekspor dataset kosakata tidak dapat dipulihkan sebagai progres.');
      const schema=Number(raw.schemaVersion||0);if(!Number.isInteger(schema)||schema<5||schema>V5_BACKUP_SCHEMA)throw new Error('Versi skema backup tidak didukung.');
      const d=raw.data;
      return {progress:v5PlainProgress(d.progress||{}),daily:v5MergeDaily({},d.daily||{}),session:isPlainObject(d.session)?d.session:{},quizHistory:v5MergeHistory([],d.quizHistory||[]),preferences:isPlainObject(d.preferences)?d.preferences:{},skillProgress:v5PlainSkills(d.skillProgress||{}),imported:Array.isArray(d.imported)?d.imported:[],schemaVersion:Number(raw.schemaVersion||0),sourceFormat:'v5'};
    }
    // Legacy V2/V3/V4 exported progress had top-level fields.
    if(isPlainObject(raw.progress)){
      const importedCandidate=Array.isArray(raw.imported)?raw.imported:(Array.isArray(raw.words)&&raw.app==='Nihongo Study Deck'&&raw.kind==='full-backup'?raw.words:[]);
      return {progress:v5PlainProgress(raw.progress),daily:v5MergeDaily({},raw.daily||{}),session:isPlainObject(raw.session)?raw.session:{},quizHistory:v5MergeHistory([],raw.quizHistory||[]),preferences:isPlainObject(raw.preferences)?raw.preferences:{},skillProgress:v5PlainSkills(isPlainObject(raw.skillProgress)?raw.skillProgress:{}),imported:importedCandidate,schemaVersion:Number(raw.schemaVersion||0),sourceFormat:'legacy'};
    }
    throw new Error('Format tidak dikenali. Pilih backup progres Nihongo Study Deck V2–V5, bukan file dataset kosakata.');
  }
  function v5ValidateImported(importedRows){
    if(!Array.isArray(importedRows))throw new Error('Dataset cadangan tidak valid.');
    if(importedRows.length>100000)throw new Error('Dataset cadangan terlalu besar.');
    importedRows.forEach((w,i)=>validateWord(w,i));
    return importedRows;
  }
  function v5SnapshotStorage(keys){const snapshot={};for(const key of keys)snapshot[key]=v5ReadRaw(key);return snapshot;}
  function v5CommitStorage(entries){
    const keys=Object.keys(entries),before=v5SnapshotStorage(keys);
    try{for(const key of keys)localStorage.setItem(key,JSON.stringify(entries[key]));return true;}
    catch(err){for(const key of keys){try{if(before[key]===null)localStorage.removeItem(key);else localStorage.setItem(key,before[key]);}catch(_){}}throw new Error('Penyimpanan gagal; perubahan dibatalkan sejauh yang diizinkan browser. Ekspor progres dan kurangi data impor sebelum mencoba lagi.');}
  }
  exportDataset = function(){
    const words=canonicalExport();
    download('nihongo-study-deck-v5-dataset.json',JSON.stringify({app:'Nihongo Study Deck',kind:'vocabulary-dataset',schemaVersion:V5_DATASET_SCHEMA,exportedAt:new Date().toISOString(),wordCount:words.length,words},null,2));
  };
  exportProgress = function(){
    const backup={app:'Nihongo Study Deck',kind:'full-backup',schemaVersion:V5_BACKUP_SCHEMA,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),wordCount:allWords.length,data:{progress:cloneJSON(progress),daily:cloneJSON(daily),session:safeRead(STORAGE.session,{}),quizHistory:cloneJSON(quizHistory),preferences:cloneJSON(studyPrefs),skillProgress:cloneJSON(v3SkillProgress),imported:cloneJSON(imported)}};
    download('nihongo-study-deck-v5-backup.json',JSON.stringify(backup,null,2));
  };
  restoreProgressBackup = async function(file){
    if(!file)return;
    try{
      v5Status('Memvalidasi backup…');
      const raw=JSON.parse(await file.text());
      const b=v5NormalizeBackup(raw);
      const importedRows=v5ValidateImported(b.imported||[]);
      const nextImported=v5MergeImported(imported,importedRows);
      const nextProgress=v5ObjectMerge(b.progress,progress);
      const nextDaily=v5MergeDaily(daily,b.daily);
      const nextHistory=v5MergeHistory(quizHistory,b.quizHistory);
      const nextPrefs=v5ObjectMerge(b.preferences,studyPrefs);
      const nextSkills=v5ObjectMerge(b.skillProgress,v3SkillProgress);
      const nextSession=(b.session&&b.session.id)?b.session:safeRead(STORAGE.session,{});
      const ok=confirm('Pulihkan backup? Data progres dari backup akan digabungkan; untuk ID yang sama, nilai backup dipakai. Data lokal yang tidak tercantum dipertahankan. Dataset inti 1.131 entri tidak diubah.');
      if(!ok)return;
      v5CommitStorage({[STORAGE.progress]:nextProgress,[STORAGE.daily]:nextDaily,[STORAGE.quizHistory]:nextHistory,[STORAGE.prefs]:nextPrefs,[V3_STORAGE.skills]:nextSkills,[STORAGE.imported]:nextImported,[STORAGE.session]:nextSession});
      progress=nextProgress;daily=nextDaily;quizHistory=nextHistory;studyPrefs=nextPrefs;v3SkillProgress=nextSkills;imported=nextImported;allWords=mergeDatasets(SEED,imported);
      fillCategoryOptions();applyFilters();renderStats();
      v5Status(`Backup dipulihkan (${b.sourceFormat}, skema ${b.schemaVersion||'lama'}). Progres digabungkan; kosakata inti tetap ${SEED.length} entri.`);
    }catch(e){v5Status('Pemulihan gagal: '+(e.message||String(e)),true);}
    finally{$5('restoreProgressFile').value='';}
  };

  // Import only vocabulary; never import progress or personal settings from a dataset file.
  importDataset = async function(file){
    if(!file)return;
    try{
      v5Status('Memvalidasi dataset…');
      const raw=JSON.parse(await file.text());
      const rows=Array.isArray(raw)?raw:(isPlainObject(raw)&&Array.isArray(raw.words)?raw.words:null);
      if(!rows)throw new Error('Format dataset tidak dikenali. Gunakan array kosakata atau objek dengan properti words. Backup progres tidak dapat diimpor sebagai dataset.');
      if(!rows.length)throw new Error('Dataset kosong.');if(rows.length>100000)throw new Error('Maksimum 100.000 entri per impor.');
      rows.forEach((w,i)=>validateWord(w,i));
      const usedIds=new Set(allWords.map(w=>String(w.id))),staged=cloneJSON(imported);let added=0,enriched=0,duplicates=0;
      for(let i=0;i<rows.length;i++){
        const w=rows[i],key=keyFor(w),existing=allWords.find(x=>keyFor(x)===key);
        if(existing){
          duplicates++;
          const oldExamples=Array.isArray(existing.examples)?existing.examples:[];
          const newExamples=Array.isArray(w.examples)?w.examples:[];
          const sig=ex=>[ex.japanese||'',ex.reading||'',ex.translation||'',ex.target||''].join('|').toLocaleLowerCase();
          const have=new Set(oldExamples.map(sig));const extras=newExamples.filter(ex=>!have.has(sig(ex)));
          const newCats=(w.categories||[]).filter(c=>!(existing.categories||[]).includes(c));
          if(extras.length||newCats.length||(!existing.exampleJapanese&&w.exampleJapanese)||(!existing.usageNotes&&(w.usageNotes||w.notes))){
            const copy={...existing,categories:[...new Set([...(existing.categories||[]),...(w.categories||[])])],examples:[...oldExamples,...extras]};
            for(const k of ['exampleJapanese','exampleReading','exampleMeaning','usageNotes','relatedWords'])if(!copy[k]&&w[k])copy[k]=w[k];
            const idx=staged.findIndex(x=>keyFor(x)===key);if(idx>=0)staged[idx]=copy;else if(!SEED.some(x=>keyFor(x)===key))staged.push(copy);enriched++;
          }
          continue;
        }
        const copy={...w,id:uniqueId(w.id||`import-${Date.now()}-${i+1}`,usedIds),japanese:w.japanese.trim(),hiragana:w.hiragana.trim(),meaning:w.meaning.trim(),partOfSpeech:w.partOfSpeech.trim(),jlpt:w.jlpt||'Unclassified',categories:Array.isArray(w.categories)&&w.categories.length?w.categories.filter(c=>typeof c==='string').map(c=>c.trim()).filter(Boolean):['impor'],examples:Array.isArray(w.examples)?w.examples:[],exampleJapanese:w.exampleJapanese||'',exampleReading:w.exampleReading||'',exampleMeaning:w.exampleMeaning||'',usageNotes:w.usageNotes||w.notes||'',relatedWords:w.relatedWords||[]};staged.push(copy);added++;
      }
      if(!added&&!enriched){v5Status(`Tidak ada perubahan. ${duplicates} entri sudah ada; progres dan pengaturan tidak disentuh.`);return;}
      const nextImported=v5MergeImported(staged,[]);
      v5CommitStorage({[STORAGE.imported]:nextImported});
      imported=nextImported;allWords=mergeDatasets(SEED,imported);fillCategoryOptions();applyFilters(currentId);
      v5Status(`Impor dataset selesai: ${added} kosakata baru, ${enriched} entri diperkaya, ${duplicates} duplikat diperiksa. Total ${allWords.length}. Progres pribadi tidak diimpor.`);
    }catch(e){v5Status('Impor gagal: '+(e.message||String(e)),true);}
    finally{$5('importFile').value='';}
  };

  function v5SetResetModal(){
    const modal=$5('confirmModal'),body=modal?.querySelector('.modal'),title=$5('modalTitle');if(!modal||!body)return;
    let note=body.querySelector('#v5ResetExplanation');if(!note){note=document.createElement('p');note.id='v5ResetExplanation';title.textContent='Pilih tindakan reset';const oldP=body.querySelector('p');if(oldP)oldP.replaceWith(note);else title.after(note);}
    note.textContent='Pilih cakupan reset. Tindakan hanya memengaruhi data lokal pada browser ini; dataset bawaan tidak berubah kecuali saat menghapus semua data lokal.';
    let actions=body.querySelector('.modal-actions');if(!actions){actions=document.createElement('div');actions.className='modal-actions';body.append(actions);}actions.replaceChildren();
    actions.style.display='grid';actions.style.gridTemplateColumns='repeat(auto-fit,minmax(190px,1fr))';actions.style.gap='8px';
    const make=(label,description,cls,fn)=>{const wrap=document.createElement('div');wrap.style.display='grid';wrap.style.gap='4px';const b=document.createElement('button');b.type='button';b.textContent=label;b.className=cls||'';b.addEventListener('click',()=>{closeReset();fn()});const small=document.createElement('small');small.className='tiny';small.textContent=description;wrap.append(b,small);actions.append(wrap);};
    make('Reset sesi aktif','Hapus sesi kartu/kuis yang tersimpan; progres tetap ada.','',v5ResetSession);
    make('Hapus riwayat kuis','Hapus ringkasan sesi kuis; progres per kosakata tetap ada.','',v5ResetQuizHistory);
    make('Reset progres belajar','Hapus progres SRS, progres keterampilan, dan aktivitas harian.','warn',v5ResetProgress);
    make('Hapus semua data lokal','Hapus progres, riwayat, preferensi, dan kosakata impor.','danger',v5ResetAll);
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Batal';cancel.className='soft';cancel.addEventListener('click',closeReset);actions.append(cancel);
  }
  function v5ResetSession(){
    try{document.dispatchEvent(new CustomEvent('v10-reset',{detail:{scope:'session'}}))}catch(_){}
    quizSession=null;passageQuestionState=null;
    try{localStorage.removeItem(STORAGE.session);localStorage.removeItem(STORAGE.quiz);}catch(_){}
    $5('quizStage').classList.add('hidden');$5('quizSummary').classList.add('hidden');$5('quizSetup').classList.remove('hidden');
    if($5('passageFeedback')){$5('passageFeedback').className='feedback hidden';$5('passageChoices').replaceChildren();}
    try{localStorage.removeItem(STORAGE.session);}catch(_){}
    v5Status('Sesi aktif dan sesi yang dapat dilanjutkan dihapus. Progres belajar tidak berubah.');
  }
  function v5ResetQuizHistory(){
    quizHistory=[];
    if(!save(STORAGE.quizHistory,quizHistory))return;
    renderStats();v5Status('Riwayat kuis dihapus. Statistik kuis tersimpan di progres per kosakata tidak diubah.');
  }
  function v5ResetProgress(){
    try{document.dispatchEvent(new CustomEvent('v10-reset',{detail:{scope:'progress'}}))}catch(_){}
    const emptyProgress={},emptyDaily={},emptySkills={};
    try{v5CommitStorage({[STORAGE.progress]:emptyProgress,[STORAGE.daily]:emptyDaily,[V3_STORAGE.skills]:emptySkills,[STORAGE.session]:{}});}
    catch(e){v5Status(e.message,true);return;}
    progress=emptyProgress;daily=emptyDaily;v3SkillProgress=emptySkills;quizSession=null;passageQuestionState=null;
    $5('quizStage').classList.add('hidden');$5('quizSummary').classList.add('hidden');$5('quizSetup').classList.remove('hidden');
    applyFilters();progress={};daily={};v3SkillProgress={};save(STORAGE.progress,progress);save(STORAGE.daily,daily);save(V3_STORAGE.skills,v3SkillProgress);try{localStorage.removeItem(STORAGE.session);}catch(_){}renderStats();v5Status('Progres belajar, jadwal SRS, progres keterampilan, dan aktivitas harian direset. Riwayat kuis, preferensi, dan dataset impor tetap ada.');
  }
  function v5ResetAll(){
    if(!confirm('Hapus SEMUA data lokal Nihongo Study Deck pada browser ini, termasuk progres, riwayat kuis, preferensi, dan kosakata impor? Buat backup terlebih dahulu jika masih dibutuhkan.'))return;
    try{document.dispatchEvent(new CustomEvent('v10-reset',{detail:{scope:'all'}}))}catch(_){}
    const keep=[];
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&(/^(jvfc_|nihongo_study_deck_v5_migration$)/.test(k)||k==='undefined')&&!/_recovery_/.test(k))keep.push(k);}keep.forEach(k=>localStorage.removeItem(k));}
    catch(e){v5Status('Sebagian data mungkin gagal dihapus: '+(e.message||String(e)),true);return;}
    progress={};daily={};quizHistory=[];studyPrefs={};v3SkillProgress={};imported=[];quizSession=null;passageQuestionState=null;allWords=mergeDatasets(SEED,[]);
    try{save(STORAGE.progress,progress);save(STORAGE.daily,daily);save(STORAGE.quizHistory,quizHistory);save(STORAGE.prefs,studyPrefs);save(V3_STORAGE.skills,v3SkillProgress);save(STORAGE.imported,imported);}catch(_){}
    fillCategoryOptions();$5('search').value='';$5('jlptFilter').value='all';$5('posFilter').value='all';$5('categoryFilter').value='all';$5('studyFilter').value='all';$5('orderMode').value='ordered';
    $5('quizStage').classList.add('hidden');$5('quizSummary').classList.add('hidden');$5('quizSetup').classList.remove('hidden');
    $5('v3GoalInput').value='20';$5('v3PracticeSkill').value='overall';$5('fontSize').value='56';$5('fontSizeText').textContent='56 px';$5('japaneseWord').style.fontSize='56px';document.documentElement.classList.add('light-theme');document.documentElement.classList.remove('dark-theme');
    applyFilters();progress={};daily={};quizHistory=[];studyPrefs={};v3SkillProgress={};imported=[];allWords=mergeDatasets(SEED,[]);save(STORAGE.progress,progress);save(STORAGE.daily,daily);save(STORAGE.quizHistory,quizHistory);save(STORAGE.prefs,studyPrefs);save(V3_STORAGE.skills,v3SkillProgress);save(STORAGE.imported,imported);try{localStorage.removeItem(STORAGE.session);}catch(_){}renderStats();v5Status('Semua data lokal aktif dihapus. Dataset bawaan '+SEED.length+' kosakata tetap tersedia.');
  }
  // Ensure every destructive operation is reachable through one clearly scoped reset dialog.
  const resetBtn=$5('resetProgressBtn');
  if(resetBtn){const copy=resetBtn.cloneNode(true);resetBtn.replaceWith(copy);copy.addEventListener('click',()=>{v5SetResetModal();$5('confirmModal').classList.add('open');$5('confirmModal').querySelector('.modal-actions button')?.focus();});}
  // Replace legacy one-action handler with a dedicated V5 action menu.
  const confirmBtn=$5('confirmResetBtn');if(confirmBtn){const copy=confirmBtn.cloneNode(true);confirmBtn.replaceWith(copy);copy.addEventListener('click',()=>{v5SetResetModal();});}

  // Replace the old import/restore/export event wiring so the new schema is used exactly once.
  const v5ReplaceClick=(id,handler)=>{const old=$5(id);if(!old)return;const copy=old.cloneNode(true);old.replaceWith(copy);copy.addEventListener('click',handler);return copy;};
  const v5ReplaceInput=(id,handler)=>{const old=$5(id);if(!old)return;const copy=old.cloneNode(true);old.replaceWith(copy);copy.addEventListener('change',()=>{const file=copy.files?.[0];if(file)handler(file);});return copy;};
  const datasetInput=v5ReplaceInput('importFile',importDataset);
  const backupInput=v5ReplaceInput('restoreProgressFile',restoreProgressBackup);
  v5ReplaceClick('importBtn',()=>datasetInput?.click());
  v5ReplaceClick('restoreProgressBtn',()=>backupInput?.click());
  v5ReplaceClick('exportDatasetBtn',exportDataset);
  v5ReplaceClick('exportProgressBtn',exportProgress);

  // Word-order accepts punctuation/spacing normalization but preserves token order.
  if(typeof v3SubmitOrderAnswer==='function'){
    v3SubmitOrderAnswer=function(){
      if(!quizSession||!v3OrderState||v3OrderState.completed)return;
      const q=v3OrderState.q,constructed=v3OrderState.selected.map(x=>x.text).join('')+v3OrderState.ending,expected=q.word.exampleJapanese;
      const norm=s=>String(s||'').normalize('NFC').replace(/[\s\u3000]/gu,'').replace(/[。！？!?]+$/u,'').replace(/[，,]/gu,'、');
      const correct=norm(constructed)===norm(expected);v3OrderState.completed=true;quizSession.answered++;
      if(correct)quizSession.correct++;else{quizSession.wrong++;quizSession.missed.push(q.word.id);}
      const old=wordProgress(q.word);
      progress[q.word.id]={...old,quizAttempts:Number(old.quizAttempts||0)+1,quizCorrect:Number(old.quizCorrect||0)+(correct?1:0),mistakes:Number(old.mistakes||0)+(correct?0:1),history:[...(old.history||[]),{at:Date.now(),rating:correct?'word-order-correct':'word-order-wrong'}].slice(-30)};
      save(STORAGE.progress,progress);if(typeof v3RecordSkillAttempt==='function')v3RecordSkillAttempt(q.word.id,'context',correct);
      const fb=$5('quizFeedback');fb.className='feedback '+(correct?'good-feedback':'bad-feedback');fb.replaceChildren();const strong=document.createElement('strong');strong.textContent=correct?'Susunan benar.':'Susunan belum tepat.';const line=document.createElement('div');line.style.marginTop='6px';line.textContent='Jawaban: '+expected;fb.append(strong,line);
      if(q.word.exampleReading){const r=document.createElement('div');r.textContent='Bacaan: '+q.word.exampleReading;fb.append(r);}if(q.word.exampleMeaning){const m=document.createElement('div');m.textContent='Arti: '+q.word.exampleMeaning;fb.append(m);}
      for(const b of $5('quizChoices').querySelectorAll('button'))b.disabled=true;$5('nextQuizBtn').disabled=false;$5('quizScoreLabel').textContent='Benar '+quizSession.correct;$5('quizRunningScore').textContent='Benar '+quizSession.correct+' · Salah '+quizSession.wrong;
      quizSession.answers.push({id:q.word.id,selected:constructed,answer:expected,correct,at:Date.now()});renderStats();
    };
  }
  // Use a dedicated session/backup schema in the audit view, without implying linguistics are verified.
  const homeFoot=$5('v3HomePanel')?.querySelector('.v3-home-foot');
  if(homeFoot&&!$5('v5VersionNote')){const note=document.createElement('span');note.id='v5VersionNote';note.className='tiny';note.textContent='V5.0 · migrasi kompatibel · backup berversi';homeFoot.append(note);}
  const brand=$5('v3HomePanel')?.closest('.app')?.querySelector('.brand h1');if(brand&&!brand.querySelector('.v5-version')){const badge=document.createElement('span');badge.className='v5-version';badge.textContent='V5.0';badge.setAttribute('aria-label','Versi 5.0');brand.append(' ',badge);}
  const footer=document.querySelector('.footer-note');if(footer)footer.textContent='Nihongo Study Deck V5.0 · HTML mandiri untuk penggunaan offline. Audio memakai text-to-speech sistem jika tersedia, bukan rekaman native. Penyimpanan lokal bergantung pada dukungan browser; buat backup secara berkala.';
  document.title='Nihongo Study Deck V5.0';
  const appMeta=document.querySelector('meta[name="application-name"]');if(appMeta)appMeta.content='Nihongo Study Deck V5.0';
  const desc=document.querySelector('meta[name="description"]');if(desc)desc.content='Nihongo Study Deck V5.0: aplikasi belajar bahasa Jepang offline dengan SRS, kuis, reading, backup berversi, dan progres lokal.';
  const v5Style=document.createElement('style');v5Style.textContent=`
    .modal{max-height:calc(100dvh - 30px);overflow:auto}.modal-actions button{white-space:normal}.v5-version{display:inline-flex;vertical-align:middle;align-items:center;border:1px solid var(--line);border-radius:7px;padding:2px 6px;font-size:.68rem;letter-spacing:.03em;font-weight:750;color:var(--muted)}
    button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
    [aria-live]{overflow-wrap:anywhere}.v5-status-note{font-size:.8rem;color:var(--muted)}
    @media(max-width:540px){.modal-backdrop{padding:10px}.modal{padding:16px}.modal-actions{grid-template-columns:1fr!important}.modal-actions>div{min-width:0!important}}
  `;document.head.append(v5Style);
  // Ensure newly introduced aliases are visible in the current audit report and persist migration metadata.
  try{window.NihongoStudyDeckV5={version:APP_VERSION,migration:v5Migration,seedCount:SEED.length,storageSchema:V5_BACKUP_SCHEMA};}catch(_){}
  try { v5Status(`Nihongo Study Deck V5.0 siap · ${SEED.length} kosakata inti · migrasi diperiksa${v5Migration.corrupt?` · ${v5Migration.corrupt} key lama perlu diperiksa`:''}${v5StoragePersistent?' · storage tersedia':' · storage persisten tidak tersedia; backup file tetap disarankan'}.`,!v5StoragePersistent); } catch(_) {}
})();

