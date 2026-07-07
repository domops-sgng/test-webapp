(function(){
  // ============ CONFIG — paste your Apps Script Web App URL here once deployed ============
  const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbwucf4KV-p6bv90O54Ca-A04Q1fs1L7eBOaT3MpHF7BSaZ0_1M-yO2a47MRS7VQ2HGG/exec"; // e.g. "https://script.google.com/macros/s/XXXXX/exec" — leave blank for local demo mode
  // ==========================================================================================

  const DEMO_MODE = !SHEET_API_URL;

  const DEFAULT_COURSES = [
    'D.PHARMA','B.PHARMA','P.B.B.Sc-Nursing','GNM-Nursing','B.TECH',
    'Foreign Language Training-German','Foreign Language Training-Japanese',
    'Foreign Language Training-French','Foreign Language Training-Spanish',
    'Other'
  ];

  let state = { code:'SGNG', courses:DEFAULT_COURSES.slice() };

  const panel = document.getElementById('lt-panel');
  const codePill = document.getElementById('lt-code-pill');
  const modeBanner = document.getElementById('lt-mode-banner');

  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function randomSuffix(len){
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let out = '';
    for(let i=0; i<len; i++) out += chars[Math.floor(Math.random()*chars.length)];
    return out;
  }

  // ---------- API layer: talks to Apps Script if configured, else falls back to local demo storage ----------
  async function apiCall(action, payload){
    if(!DEMO_MODE){
      const res = await fetch(SHEET_API_URL, {
        method:'POST',
        headers:{'Content-Type':'text/plain;charset=utf-8'}, // avoids CORS preflight against Apps Script
        body: JSON.stringify(Object.assign({action}, payload||{}))
      });
      return await res.json();
    }
    return localApi(action, payload);
  }

  async function localApi(action, payload){
    switch(action){
      case 'getConfig': {
        try{
          const r = await window.storage.get('lt-config', true);
          return r && r.value ? JSON.parse(r.value) : await localApi('resetConfig');
        }catch(e){ return await localApi('resetConfig'); }
      }
      case 'resetConfig': {
        const cfg = {code:'SGNG', nextSerial:1, courses:DEFAULT_COURSES};
        await window.storage.set('lt-config', JSON.stringify(cfg), true);
        return cfg;
      }
      case 'submitLead': {
        const cfg = await localApi('getConfig');
        const serial = cfg.nextSerial;
        const id = `${cfg.code}-${String(serial).padStart(4,'0')}-${randomSuffix(6)}`;
        await window.storage.set('lt-lead:'+id, JSON.stringify(Object.assign({}, payload, {id, submittedAt:new Date().toISOString()})), true);
        cfg.nextSerial = serial + 1;
        await window.storage.set('lt-config', JSON.stringify(cfg), true);
        return {id};
      }
    }
  }

  async function loadConfig(){
    const cfg = await apiCall('getConfig');
    state.code = cfg.code || 'SGNG';
    state.courses = (cfg.courses && cfg.courses.length) ? cfg.courses : DEFAULT_COURSES;
    codePill.textContent = state.code;
  }

  async function init(){
    modeBanner.innerHTML = DEMO_MODE
      ? `<div class="lt-mode-banner">Demo mode — data is stored temporarily for testing. Paste your Google Sheet Apps Script URL into the SHEET_API_URL constant in script.js to switch to the real Sheet.</div>`
      : '';
    panel.innerHTML = `<div class="lt-card">Loading…</div>`;
    await loadConfig();
    renderForm();
  }

  function renderForm(){
    panel.innerHTML = `
      <div class="lt-card">
        <h2>Student / Parent Registration</h2>
        <p class="lt-sub">Only what's needed to start a counselling call. Shared with the admissions team under referral code <strong>${state.code}</strong>.</p>

        <label style="display:block; font-size:12px; font-weight:600; color:var(--ink-soft); text-transform:uppercase; letter-spacing:.04em; margin-bottom:8px;">Who is filling this form?</label>
        <div class="lt-radiogroup" id="lt-filler-group">
          <label class="lt-radio active" data-val="Student"><input type="radio" name="filler" value="Student" checked>Student</label>
          <label class="lt-radio" data-val="Parent"><input type="radio" name="filler" value="Parent">Parent</label>
        </div>

        <form id="lt-submit-form">
          <div id="lt-parent-fields" style="display:none;">
            <div class="lt-row">
              <div class="lt-field"><label>Parent name</label><input name="parentName" placeholder="Full name"></div>
              <div class="lt-field"><label>Parent mobile</label><input name="parentPhone" placeholder="10-digit mobile" pattern="[0-9+ ]{7,15}"></div>
            </div>
          </div>

          <div class="lt-field"><label>Student name</label><input required name="studentName" placeholder="Full name"></div>
          <div class="lt-row">
            <div class="lt-field"><label>Student mobile</label><input required name="studentPhone" placeholder="10-digit mobile" pattern="[0-9+ ]{7,15}"></div>
            <div class="lt-field"><label>Email</label><input type="email" name="email" placeholder="name@example.com"></div>
          </div>
          <div class="lt-row">
            <div class="lt-field"><label>City</label><input required name="city" placeholder="City"></div>
            <div class="lt-field"><label>Course interested in</label>
              <select required name="course" id="lt-course-select">
                <option value="" disabled selected>Select a course</option>
                ${state.courses.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="lt-field" id="lt-course-other-field" style="display:none;">
            <label>Please specify the course</label>
            <input name="courseOther" placeholder="Type the course name">
          </div>
          <div class="lt-field"><label>Best time to call</label>
            <select name="preferredTime">
              <option>Morning</option><option>Afternoon</option><option>Evening</option><option>Anytime</option>
            </select>
          </div>
          <label class="lt-checkbox">
            <input type="checkbox" required name="consent">
            <span>I agree that these details will be shared with the college's admissions counselling team for the purpose of a callback about admission options.</span>
          </label>
          <button class="lt-btn" type="submit">Submit details</button>
        </form>
        <div id="lt-submit-result" style="margin-top:16px;"></div>
      </div>
    `;

    document.querySelectorAll('#lt-filler-group .lt-radio').forEach(r=>{
      r.addEventListener('click', ()=>{
        document.querySelectorAll('#lt-filler-group .lt-radio').forEach(x=>x.classList.remove('active'));
        r.classList.add('active');
        r.querySelector('input').checked = true;
        document.getElementById('lt-parent-fields').style.display = r.dataset.val==='Parent' ? 'block' : 'none';
      });
    });

    const courseSelect = document.getElementById('lt-course-select');
    const otherField = document.getElementById('lt-course-other-field');
    const otherInput = otherField.querySelector('input');
    courseSelect.addEventListener('change', ()=>{
      const isOther = courseSelect.value === 'Other';
      otherField.style.display = isOther ? 'block' : 'none';
      otherInput.required = isOther;
      if(!isOther) otherInput.value = '';
    });

    document.getElementById('lt-submit-form').addEventListener('submit', onSubmitLead);
  }

  async function onSubmitLead(e){
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const btn = form.querySelector('button');
    btn.disabled = true; btn.textContent = 'Submitting…';

    const filledBy = fd.get('filler') || 'Student';
    let course = fd.get('course');
    if(course === 'Other'){
      course = (fd.get('courseOther')||'').trim() || 'Other';
    }

    const payload = {
      filledBy,
      parentName: filledBy==='Parent' ? (fd.get('parentName')||'').trim() : '',
      parentPhone: filledBy==='Parent' ? (fd.get('parentPhone')||'').trim() : '',
      studentName: fd.get('studentName').trim(),
      studentPhone: fd.get('studentPhone').trim(),
      email: (fd.get('email')||'').trim(),
      city: fd.get('city').trim(),
      course: course,
      preferredTime: fd.get('preferredTime'),
      consent: true
    };

    try{
      const result = await apiCall('submitLead', payload);
      document.getElementById('lt-submit-result').innerHTML = `
        <div class="lt-success">
          Details submitted. Please note this reference ID for follow-up:
          <div class="lt-idbox">${result.id}</div>
        </div>`;
      form.reset();
      document.getElementById('lt-parent-fields').style.display='none';
      document.getElementById('lt-course-other-field').style.display='none';
      document.querySelectorAll('#lt-filler-group .lt-radio').forEach(x=>x.classList.remove('active'));
      document.querySelector('#lt-filler-group .lt-radio[data-val="Student"]').classList.add('active');
    }catch(err){
      document.getElementById('lt-submit-result').innerHTML = `<div class="lt-error">Something went wrong saving this — please try again.</div>`;
    }
    btn.disabled = false; btn.textContent = 'Submit details';
  }

  init();
})();
