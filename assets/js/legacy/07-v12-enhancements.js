
(()=>{
  'use strict';
  document.title='Nihongo Study Deck V12.0';
  const meta=document.querySelector('meta[name="application-name"]');if(meta)meta.content='Nihongo Study Deck V12.0';
  const title=document.querySelector('#v11ReadingIntelligence .v10-card-heading h3');if(title)title.textContent='Offline Reading Library N5–N1';
  const subtitle=document.querySelector('#v11ReadingIntelligence .v10-card-heading .tiny');if(subtitle)subtitle.textContent='Target 750 bacaan inti N5–N1. Paket penguatan dan transisi V11 tetap tersedia. Materi berstatus tinjauan bahasa belum selesai bukan materi terverifikasi.';
  // Ensure initial display of the selected reading follows the saved furigana preference.
  const size=document.getElementById('v11FuriganaSize');if(size){try{const st=JSON.parse(localStorage.getItem('nihongoStudyDeckV11ReadingState')||'{}');size.value=st.furiganaSize||'medium';document.documentElement.dataset.furiganaSize=size.value;}catch(_){document.documentElement.dataset.furiganaSize='medium';}}
  // Add aria hints for ruby text and clarify the interactive level options.
  document.querySelectorAll('.v11-furigana-text ruby').forEach(r=>r.setAttribute('aria-label',r.textContent||''));
  try{const lib=window.NihongoReadingIntelligenceV11;if(lib)window.NihongoReadingIntelligenceV12={version:'12.0.0',targetCorePerLevel:150,levels:['N5','N4','N3','N2','N1'],supplementalRetained:true,storageCompatibility:'V11 reading progress key retained'};}catch(_){ }
})();
