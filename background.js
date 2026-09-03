const runs = new Map();
const sleep = ms => new Promise(r => setTimeout(r, ms));

function numericSetting(value, fallback, min = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, n) : fallback;
}

function parsePrompt(text, parseRawAt = true) {
  const segments = [];
  const pattern = parseRawAt
    ? /\{\{([^{}]+)\}\}|@\[([^\]]+)\]|(?<![\w.+-])@([A-Za-z0-9][A-Za-z0-9._-]{0,191})/g
    : /\{\{([^{}]+)\}\}|@\[([^\]]+)\]/g;
  let last = 0, m;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) segments.push({type:'text',value:text.slice(last,m.index)});
    const asset = (m[1] || m[2] || m[3] || '').trim();
    if (asset) segments.push({type:'reference',value:asset,source:m[0]});
    else segments.push({type:'text',value:m[0]});
    last = pattern.lastIndex;
  }
  if (last < text.length) segments.push({type:'text',value:text.slice(last)});
  return segments;
}

function statsFor(segments) {
  const counts = new Map();
  for (const s of segments) if (s.type === 'reference') counts.set(s.value,(counts.get(s.value)||0)+1);
  return {
    mentions:[...counts.values()].reduce((a,b)=>a+b,0),
    unique:counts.size,
    counts:[...counts.entries()].sort((a,b)=>b[1]-a[1])
  };
}

async function ensureAgent(tabId) {
  try {
    const pong = await chrome.tabs.sendMessage(tabId,{type:'FPT51_PING'});
    if (pong?.ok) return pong;
  } catch {}

  try {
    await chrome.scripting.executeScript({target:{tabId},files:['content.js']});
  } catch (e) {
    const msg = e?.message || String(e);
    if (/Cannot access contents|chrome:\/\/|edge:\/\/|extensions gallery|restricted/i.test(msg)) {
      throw new Error('Chrome does not allow extensions to run on this browser-internal page. Open a normal Google Flow webpage first.');
    }
    throw new Error(`Could not inject into the current page: ${msg}`);
  }
  await sleep(70);
  return chrome.tabs.sendMessage(tabId,{type:'FPT51_PING'});
}

async function content(tabId, message) {
  await ensureAgent(tabId);
  return chrome.tabs.sendMessage(tabId,message);
}

async function attach(tabId) {
  let last;
  for (const version of ['1.3','1.2','1.1','1.0']) {
    try {
      await chrome.debugger.attach({tabId},version);
      return version;
    } catch (e) {
      last = e;
      const msg = String(e?.message || e);
      if (/already attached/i.test(msg)) throw new Error('Another debugger or DevTools session is attached to this tab. Close DevTools for this tab and try again.');
      if (!/protocol version/i.test(msg)) break;
    }
  }
  throw last || new Error('Could not attach Chrome input controller.');
}

async function cdp(tabId, method, params = {}) {
  return chrome.debugger.sendCommand({tabId},method,params);
}

async function key(tabId,{key,code='',vk=0,text,modifiers=0}) {
  const base = {key,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk,modifiers};
  const down = {type:'keyDown',...base};
  if (text !== undefined) { down.text = text; down.unmodifiedText = text; }
  await cdp(tabId,'Input.dispatchKeyEvent',down);
  await cdp(tabId,'Input.dispatchKeyEvent',{type:'keyUp',...base});
}

function keySpec(ch) {
  if (/^[a-zA-Z]$/.test(ch)) {
    const u = ch.toUpperCase();
    return {key:ch,code:`Key${u}`,vk:u.charCodeAt(0),text:ch};
  }
  if (/^[0-9]$/.test(ch)) return {key:ch,code:`Digit${ch}`,vk:ch.charCodeAt(0),text:ch};
  const map = {
    '.':{key:'.',code:'Period',vk:190,text:'.'},
    '-':{key:'-',code:'Minus',vk:189,text:'-'},
    '_':{key:'_',code:'Minus',vk:189,text:'_',modifiers:8},
    ' ':{key:' ',code:'Space',vk:32,text:' '},
    '(':{key:'(',code:'Digit9',vk:57,text:'(',modifiers:8},
    ')':{key:')',code:'Digit0',vk:48,text:')',modifiers:8}
  };
  return map[ch] || {key:ch,code:'',vk:0,text:ch};
}

async function typeChars(tabId,text,delay,state) {
  for (const ch of text) {
    if (state.aborted) throw new Error('Stopped by user.');
    await key(tabId,keySpec(ch));
    if (delay > 0) await sleep(delay);
  }
}

async function typeAt(tabId) {
  // US keyboard semantics: Shift+2. Supplying text='@' is what matters to CDP.
  await key(tabId,{key:'@',code:'Digit2',vk:50,text:'@',modifiers:8});
}
async function pressEnter(tabId) { await key(tabId,{key:'Enter',code:'Enter',vk:13}); }
async function pressBackspace(tabId) { await key(tabId,{key:'Backspace',code:'Backspace',vk:8}); }

async function focusTarget(tabId) {
  const r = await content(tabId,{type:'FPT51_FOCUS'});
  if (!r?.ok) throw new Error(r?.error || 'Could not focus the selected text box.');
  return r;
}

async function clearTarget(tabId) {
  await focusTarget(tabId);
  const platform = await chrome.runtime.getPlatformInfo().catch(() => ({os:'mac'}));
  const selectAllModifier = platform?.os === 'mac' ? 4 : 2; // Meta on macOS, Control elsewhere.
  await key(tabId,{key:'a',code:'KeyA',vk:65,modifiers:selectAllModifier});
  await pressBackspace(tabId);
  await sleep(40);
  const t = await content(tabId,{type:'FPT51_TEXT'}).catch(()=>null);
  if (t?.text?.trim()) await content(tabId,{type:'FPT51_CLEAR_DOM'}).catch(()=>{});
  await focusTarget(tabId);
}

async function bindReference(tabId,asset,settings,state) {
  const keyDelay = numericSetting(settings.keyDelayMs, 6, 0);
  const afterAt = numericSetting(settings.afterAtMs, 45, 0);
  const beforeEnter = numericSetting(settings.beforeEnterMs, 220, 0);
  const afterEnter = numericSetting(settings.afterEnterMs, 160, 30);

  // EXACT Flow interaction: focus once → @ → filename → Enter.
  // Do not refocus between @ and Enter or Flow's mention mode may collapse.
  await focusTarget(tabId);
  await typeAt(tabId);
  if (afterAt) await sleep(afterAt);
  await typeChars(tabId,asset,keyDelay,state);
  if (beforeEnter) await sleep(beforeEnter);
  await pressEnter(tabId);
  if (afterEnter) await sleep(afterEnter);
}

function publish(tabId,payload) {
  chrome.runtime.sendMessage({type:'FPT51_PROGRESS',tabId,payload}).catch(()=>{});
  content(tabId,{type:'FPT51_PROGRESS',payload}).catch(()=>{});
}

async function run(tabId,payload) {
  if (runs.has(tabId)) throw new Error('A run is already active in this tab.');
  const prompt = String(payload?.prompt || '');
  if (!prompt.trim()) throw new Error('Prompt is empty.');

  const settings = payload?.settings || {};
  const segments = parsePrompt(prompt,settings.parseRawAt !== false);
  const stats = statsFor(segments);
  const state = {aborted:false};
  runs.set(tabId,state);

  let attached = false;
  let locked = false;
  let refsDone = 0;
  let protocol = null;

  try {
    await ensureAgent(tabId);
    publish(tabId,{phase:'choosing',message:'Scanning all editable text boxes on this screen…'});
    const chosen = await content(tabId,{type:'FPT51_SELECT_TARGET'});
    if (!chosen?.ok) throw new Error(chosen?.error || 'No text box selected.');

    protocol = await attach(tabId);
    attached = true;
    await sleep(60);
    await focusTarget(tabId);

    if (settings.protectFocus !== false) {
      await content(tabId,{type:'FPT51_LOCK',enabled:true}).catch(()=>{});
      locked = true;
      await focusTarget(tabId);
    }

    if (settings.replaceExisting !== false) await clearTarget(tabId);

    publish(tabId,{phase:'running',message:`Typing into “${chosen.label || 'selected text box'}” · ${stats.mentions} bound mentions · ${stats.unique} unique assets.`});

    for (const seg of segments) {
      if (state.aborted) throw new Error('Stopped by user.');
      if (seg.type === 'text') {
        if (!seg.value) continue;
        await focusTarget(tabId);
        await cdp(tabId,'Input.insertText',{text:seg.value});
      } else {
        publish(tabId,{phase:'running',message:`Binding @${seg.value} · ${refsDone + 1}/${stats.mentions}`});
        await bindReference(tabId,seg.value,settings,state);
        refsDone++;
      }
    }

    publish(tabId,{phase:'done',message:`Done · ${refsDone}/${stats.mentions} reference mentions bound.`});
    return {ok:true,refsDone,stats,protocol,target:chosen};
  } catch (e) {
    const msg = e?.message || String(e);
    publish(tabId,{phase:'error',message:msg});
    throw e;
  } finally {
    runs.delete(tabId);
    if (locked) { try { await content(tabId,{type:'FPT51_LOCK',enabled:false}); } catch {} }
    if (attached) { try { await chrome.debugger.detach({tabId}); } catch {} }
  }
}

chrome.runtime.onMessage.addListener((m,_sender,sendResponse) => {
  if (m?.type === 'FPT51_ANALYZE') {
    sendResponse({ok:true,stats:statsFor(parsePrompt(String(m.prompt||''),m.parseRawAt !== false))});
    return false;
  }
  if (m?.type === 'FPT51_SCAN_TAB') {
    content(Number(m.tabId),{type:'FPT51_SCAN'}).then(sendResponse).catch(e=>sendResponse({ok:false,error:e?.message||String(e)}));
    return true;
  }
  if (m?.type === 'FPT51_RUN') {
    run(Number(m.tabId),m.payload).then(sendResponse).catch(e=>sendResponse({ok:false,error:e?.message||String(e)}));
    return true;
  }
  if (m?.type === 'FPT51_STOP') {
    const state = runs.get(Number(m.tabId));
    if (state) state.aborted = true;
    content(Number(m.tabId),{type:'FPT51_CANCEL_CHOOSER'}).catch(()=>{});
    sendResponse({ok:true});
    return false;
  }
  if (m?.type === 'FPT51_STATUS') {
    sendResponse({ok:true,running:runs.has(Number(m.tabId))});
    return false;
  }
  return false;
});
