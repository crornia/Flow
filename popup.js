const $ = s => document.querySelector(s);
let tabId = null;
let timer = null;

function status(text, cls='') {
  const el = $('#status');
  el.textContent = text;
  el.className = `status ${cls}`.trim();
}
function esc(s) {
  return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function settings() {
  return {
    parseRawAt:$('#parseRawAt').checked,
    replaceExisting:$('#replaceExisting').checked,
    protectFocus:$('#protectFocus').checked,
    keyDelayMs:+$('#keyDelay').value,
    afterAtMs:+$('#afterAt').value,
    beforeEnterMs:+$('#beforeEnter').value,
    afterEnterMs:+$('#afterEnter').value
  };
}
async function analyze() {
  const r = await chrome.runtime.sendMessage({type:'FPT51_ANALYZE',prompt:$('#prompt').value,parseRawAt:$('#parseRawAt').checked});
  if (!r?.ok) return;
  $('#mentions').textContent = r.stats.mentions;
  $('#unique').textContent = r.stats.unique;
  const rep = r.stats.counts.filter(([,n])=>n>1);
  $('#duplicates').innerHTML = rep.length
    ? `Repeated references remain repeated real bindings: ${rep.slice(0,12).map(([n,c])=>`<code>@${esc(n)}</code> × ${c}`).join(' · ')}${rep.length>12?' …':''}`
    : (r.stats.mentions ? 'Every detected reference occurrence will be bound individually.' : 'No references detected.');
}
async function scan() {
  const el = $('#targetState');
  if (!tabId) return;
  const r = await chrome.runtime.sendMessage({type:'FPT51_SCAN_TAB',tabId}).catch(e=>({ok:false,error:e?.message||String(e)}));
  if (!r?.ok) {
    el.textContent = r?.error || 'Could not inspect this page.';
    el.className = 'target-state none';
    $('#start').disabled = true;
    return;
  }
  $('#pageState').textContent = 'Page ready';
  $('#pageState').className = 'badge ok';
  const n = r.targets?.length || 0;
  if (!n) {
    el.textContent = 'No visible editable text boxes detected on this screen.';
    el.className = 'target-state none';
    $('#start').disabled = true;
  } else if (n === 1) {
    el.innerHTML = `<strong>1 text box detected.</strong> It will be used automatically: ${esc(r.targets[0].label || 'text box')}`;
    el.className = 'target-state';
    $('#start').disabled = false;
  } else {
    el.innerHTML = `<strong>${n} text boxes detected.</strong> Click Start, then choose the exact target directly on the page.`;
    el.className = 'target-state multi';
    $('#start').disabled = false;
  }
}
async function save() {
  await chrome.storage.local.set({fptV5:{prompt:$('#prompt').value,...settings()}});
}
async function restore() {
  const d = (await chrome.storage.local.get('fptV5')).fptV5 || {};
  if (typeof d.prompt === 'string') $('#prompt').value = d.prompt;
  for (const [id,k] of [['parseRawAt','parseRawAt'],['replaceExisting','replaceExisting'],['protectFocus','protectFocus']]) if (typeof d[k] === 'boolean') $('#'+id).checked = d[k];
  for (const [id,k] of [['keyDelay','keyDelayMs'],['afterAt','afterAtMs'],['beforeEnter','beforeEnterMs'],['afterEnter','afterEnterMs']]) if (Number.isFinite(d[k])) $('#'+id).value = d[k];
}
async function start() {
  if (!tabId) return;
  const prompt = $('#prompt').value;
  if (!prompt.trim()) { status('Paste a prompt first.','error'); return; }
  await save();
  $('#start').disabled = true;
  $('#stop').disabled = false;
  status('Starting. If multiple boxes exist, choose one on the page.','active');
  chrome.runtime.sendMessage({type:'FPT51_RUN',tabId,payload:{prompt,settings:settings()}})
    .then(r=>{
      if (!r?.ok) status(r?.error || 'Run failed.','error');
      else status(`Done. ${r.refsDone} references bound.`,'success');
    })
    .catch(e=>status(e?.message || String(e),'error'))
    .finally(()=>{$('#start').disabled=false;$('#stop').disabled=true;});
  setTimeout(()=>window.close(),180);
}
async function stop() {
  if (tabId) await chrome.runtime.sendMessage({type:'FPT51_STOP',tabId});
  status('Stopping…','active');
}
chrome.runtime.onMessage.addListener(m=>{
  if (m?.type !== 'FPT51_PROGRESS' || m.tabId !== tabId) return;
  const p = m.payload || {};
  status(p.message || 'Running…',p.phase==='done'?'success':p.phase==='error'?'error':'active');
});

(async()=>{
  await restore();
  const [t] = await chrome.tabs.query({active:true,currentWindow:true});
  tabId = t?.id || null;
  if (!t) {
    $('#pageState').textContent = 'No active tab';
    $('#pageState').className = 'badge bad';
    $('#start').disabled = true;
    status('No active browser tab found.','error');
  } else if (/^(chrome|edge|about|chrome-extension):/i.test(t.url || '')) {
    $('#pageState').textContent = 'Restricted page';
    $('#pageState').className = 'badge bad';
    $('#start').disabled = true;
    status('Open a normal Google Flow webpage. Chrome blocks extensions on browser-internal pages.','error');
  } else {
    $('#pageState').textContent = 'Inspecting…';
    $('#pageState').className = 'badge';
    await scan();
    const r = await chrome.runtime.sendMessage({type:'FPT51_STATUS',tabId}).catch(()=>null);
    if (r?.running) { $('#start').disabled=true; $('#stop').disabled=false; }
  }
  await analyze();
})();

$('#prompt').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{analyze();save();},100);});
for (const el of document.querySelectorAll('input')) el.addEventListener('change',()=>{analyze();save();});
$('#start').addEventListener('click',start);
$('#stop').addEventListener('click',stop);
