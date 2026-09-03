(() => {
  const VERSION = '5.1.0';
  if (window.__FLOW_PROMPT_TYPER_V51__) return;
  window.__FLOW_PROMPT_TYPER_V51__ = true;

  let target = null;
  let targetProfile = null;
  let chooserRoot = null;
  let chooserCleanup = null;
  let clickShield = null;
  let toast = null;

  const EXT_IDS = new Set(['fpt5-chooser', 'fpt5-shield', 'fpt5-toast']);

  function isVisible(el) {
    if (!(el instanceof Element)) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 16) return false;
    if (r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    if (Number.parseFloat(s.opacity || '1') <= 0.02) return false;
    return true;
  }

  function deepElements(root = document) {
    const out = [];
    const seenRoots = new Set();
    function walk(node) {
      if (!node || seenRoots.has(node)) return;
      seenRoots.add(node);
      if (node.querySelectorAll) {
        for (const el of node.querySelectorAll('*')) {
          out.push(el);
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      }
    }
    walk(root);
    return out;
  }

  function inOurUi(el) {
    for (const id of EXT_IDS) if (el.closest?.(`#${id}`)) return true;
    return false;
  }

  function isEditable(el) {
    if (!(el instanceof HTMLElement) || inOurUi(el) || !isVisible(el)) return false;
    if (el.matches('textarea:not([disabled]):not([readonly])')) return true;
    if (el.matches('input:not([disabled]):not([readonly])')) {
      const t = String(el.getAttribute('type') || 'text').toLowerCase();
      return ['text','search','url','email','tel',''].includes(t);
    }
    if (el.isContentEditable) return true;
    if (el.getAttribute('role') === 'textbox' && el.getAttribute('aria-disabled') !== 'true') return true;
    if (el.matches('[data-lexical-editor="true"], .ProseMirror, [contenteditable="plaintext-only"]')) return true;
    return false;
  }

  function isTypingHost(el) {
    if (!isEditable(el)) return false;
    return !deepElements(el).some(child => child !== el && isEditable(child));
  }

  function cleanText(s, max = 90) {
    const v = String(s || '').replace(/\s+/g, ' ').trim();
    return v.length > max ? `${v.slice(0, max - 1)}…` : v;
  }

  function associatedLabel(el) {
    const aria = el.getAttribute?.('aria-label');
    if (aria) return cleanText(aria);
    const labelledBy = el.getAttribute?.('aria-labelledby');
    if (labelledBy) {
      const text = labelledBy.split(/\s+/).map(id => document.getElementById(id)?.innerText || '').join(' ');
      if (text.trim()) return cleanText(text);
    }
    if (el.id) {
      try {
        const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (l?.innerText?.trim()) return cleanText(l.innerText);
      } catch {}
    }
    const wrapping = el.closest?.('label');
    if (wrapping?.innerText?.trim()) return cleanText(wrapping.innerText);
    return '';
  }

  function nearbyText(el) {
    let node = el.parentElement;
    for (let depth = 0; node && depth < 3; depth++, node = node.parentElement) {
      const texts = [];
      for (const child of node.children || []) {
        if (child === el || child.contains(el)) continue;
        const t = cleanText(child.innerText || child.textContent, 70);
        if (t) texts.push(t);
      }
      if (texts.length) return cleanText(texts.join(' · '), 90);
    }
    return '';
  }

  function candidateLabel(el, index) {
    const label = associatedLabel(el);
    if (label) return label;
    const ph = cleanText(el.getAttribute?.('placeholder') || el.getAttribute?.('data-placeholder'));
    if (ph) return ph;
    const near = nearbyText(el);
    if (near) return near;
    const text = cleanText(el.matches('textarea,input') ? el.value : el.innerText, 70);
    if (text) return `Text box containing: ${text}`;
    return `Text box ${index + 1}`;
  }

  function elementText(el) {
    if (!el) return '';
    return cleanText(el.matches?.('textarea,input') ? el.value : (el.innerText || el.textContent || ''), 180);
  }

  function scanEditors() {
    const all = deepElements(document).filter(isTypingHost);
    const unique = [];
    const seen = new Set();
    for (const el of all) {
      if (seen.has(el)) continue;
      seen.add(el);
      unique.push(el);
    }
    unique.sort((a,b) => {
      const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
      if (Math.abs(ar.top - br.top) > 10) return ar.top - br.top;
      return ar.left - br.left;
    });
    return unique.map((el, index) => {
      const r = el.getBoundingClientRect();
      return {
        el, index,
        label: candidateLabel(el, index),
        placeholder: cleanText(el.getAttribute?.('placeholder') || el.getAttribute?.('data-placeholder')),
        ariaLabel: cleanText(el.getAttribute?.('aria-label')),
        role: cleanText(el.getAttribute?.('role')),
        tag: el.tagName.toLowerCase(),
        text: elementText(el),
        x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height)
      };
    });
  }

  function makeProfile(el, index = 0) {
    const r = el.getBoundingClientRect();
    return {
      label: candidateLabel(el, index),
      placeholder: cleanText(el.getAttribute?.('placeholder') || el.getAttribute?.('data-placeholder')),
      ariaLabel: cleanText(el.getAttribute?.('aria-label')),
      role: cleanText(el.getAttribute?.('role')),
      tag: el.tagName.toLowerCase(),
      x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height)
    };
  }

  function rememberTarget(el, index = 0) {
    target = el;
    targetProfile = makeProfile(el, index);
  }

  function geometryScore(c, p) {
    const dx = Math.abs((c.x + c.width / 2) - (p.x + p.width / 2));
    const dy = Math.abs((c.y + c.height / 2) - (p.y + p.height / 2));
    const dw = Math.abs(c.width - p.width);
    const dh = Math.abs(c.height - p.height);
    const diag = Math.max(1, Math.hypot(innerWidth, innerHeight));
    return Math.max(0, 24 - ((Math.hypot(dx,dy) / diag) * 80) - ((dw + dh) / Math.max(100,p.width+p.height)) * 12);
  }

  function scoreCandidate(c, p) {
    let score = geometryScore(c,p);
    if (c.tag === p.tag) score += 12;
    if (p.role && c.role === p.role) score += 12;
    if (p.ariaLabel && c.ariaLabel === p.ariaLabel) score += 36;
    if (p.placeholder && c.placeholder === p.placeholder) score += 34;
    if (p.label && c.label === p.label) score += 28;
    else if (p.label && c.label && (c.label.includes(p.label) || p.label.includes(c.label))) score += 12;
    return score;
  }

  function activeTypingHost() {
    let el = document.activeElement;
    if (!el || inOurUi(el)) return null;
    if (isTypingHost(el)) return el;
    if (el.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    if (isTypingHost(el)) return el;
    const editable = el.closest?.('textarea,input,[contenteditable="true"],[contenteditable="plaintext-only"],[role="textbox"],[data-lexical-editor="true"],.ProseMirror');
    return isTypingHost(editable) ? editable : null;
  }

  function validTarget() {
    return target && document.contains(target) && isEditable(target) && isVisible(target);
  }

  function reacquireTarget() {
    if (validTarget()) return {ok:true,reacquired:false};
    if (!targetProfile) return {ok:false};

    // Flow/React often replaces the editor node but leaves the new node focused.
    const active = activeTypingHost();
    if (active) {
      const c = scanEditors().find(x => x.el === active);
      if (c && scoreCandidate(c,targetProfile) >= 35) {
        rememberTarget(active,c.index);
        return {ok:true,reacquired:true,method:'active'};
      }
    }

    const candidates = scanEditors();
    if (!candidates.length) return {ok:false};
    if (candidates.length === 1) {
      rememberTarget(candidates[0].el,0);
      return {ok:true,reacquired:true,method:'only-candidate'};
    }

    const ranked = candidates
      .map(c => ({c,score:scoreCandidate(c,targetProfile)}))
      .sort((a,b)=>b.score-a.score);
    const best = ranked[0], second = ranked[1];
    // Require a strong match or a clear margin over the next editor to avoid silently jumping boxes.
    if (best && best.score >= 48 && (!second || best.score - second.score >= 10)) {
      rememberTarget(best.c.el,best.c.index);
      return {ok:true,reacquired:true,method:'profile',score:best.score};
    }
    return {ok:false,candidates:ranked.slice(0,3).map(x=>({label:x.c.label,score:Math.round(x.score)}))};
  }

  function placeCaretEnd(el) {
    try { el.focus({ preventScroll: true }); } catch { try { el.focus(); } catch {} }
    if (el.matches('textarea,input')) {
      const n = (el.value || '').length;
      try { el.setSelectionRange(n,n); } catch {}
      return;
    }
    const sel = getSelection();
    if (!sel) return;
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {}
  }

  function focusTarget() {
    const recovered = reacquireTarget();
    if (!recovered.ok) {
      return { ok:false, error:'Flow replaced the selected text box and it could not be identified safely. Keep the prompt panel open and run again.' };
    }
    try { target.scrollIntoView({ block:'center', inline:'nearest', behavior:'instant' }); } catch {}
    placeCaretEnd(target);
    // Refresh geometry after scrolling/rerendering while preserving stable semantic fingerprints.
    const r = target.getBoundingClientRect();
    if (targetProfile) {
      targetProfile.x = Math.round(r.left); targetProfile.y = Math.round(r.top);
      targetProfile.width = Math.round(r.width); targetProfile.height = Math.round(r.height);
    }
    return {
      ok:true,
      reacquired:Boolean(recovered.reacquired),
      label:candidateLabel(target,0),
      x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)
    };
  }

  function targetText() {
    if (!reacquireTarget().ok) return '';
    return target.matches('textarea,input') ? (target.value || '') : (target.innerText || target.textContent || '');
  }

  function clearTargetDom() {
    if (!reacquireTarget().ok) return {ok:false,error:'Selected text box disappeared.'};
    placeCaretEnd(target);
    if (target.matches('textarea,input')) {
      const proto = target.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto,'value')?.set;
      if (setter) setter.call(target,''); else target.value = '';
      target.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'deleteContentBackward',data:null}));
      target.dispatchEvent(new Event('change',{bubbles:true}));
    } else {
      try {
        const sel = getSelection();
        const range = document.createRange();
        range.selectNodeContents(target);
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand('delete', false);
        target.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'deleteContentBackward',data:null}));
      } catch {}
    }
    return {ok:true};
  }

  function removeChooser() {
    if (chooserCleanup) { try { chooserCleanup(); } catch {} }
    chooserCleanup = null;
    chooserRoot?.remove();
    chooserRoot = null;
  }

  function chooseTarget() {
    removeChooser();
    target = null;
    targetProfile = null;
    const candidates = scanEditors();
    if (!candidates.length) return Promise.resolve({ok:false,error:'No visible editable text boxes were found on this page.'});
    if (candidates.length === 1) {
      rememberTarget(candidates[0].el,0);
      placeCaretEnd(target);
      return Promise.resolve({ok:true,automatic:true,count:1,label:candidates[0].label,index:0});
    }

    return new Promise(resolve => {
      chooserRoot = document.createElement('div');
      chooserRoot.id = 'fpt5-chooser';
      chooserRoot.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';

      const banner = document.createElement('div');
      banner.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);pointer-events:auto;background:#11151c;color:#f3f6fb;border:1px solid #66718a;border-radius:12px;padding:10px 12px;box-shadow:0 16px 45px rgba(0,0,0,.48);font:600 13px/1.35 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;display:flex;align-items:center;gap:10px;max-width:min(760px,calc(100vw - 32px))';
      const msg = document.createElement('span');
      msg.textContent = `${candidates.length} editable text boxes found. Click the one Flow Prompt Typer should use.`;
      banner.appendChild(msg);
      const cancel = document.createElement('button');
      cancel.textContent = 'Cancel';
      cancel.style.cssText = 'border:1px solid #3d4658;background:#1b202a;color:#d6deec;border-radius:8px;padding:5px 8px;cursor:pointer;font:600 11px/1 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';
      banner.appendChild(cancel);
      chooserRoot.appendChild(banner);

      const overlays = [];
      for (const c of candidates) {
        const box = document.createElement('button');
        box.type = 'button';
        box.style.cssText = 'position:fixed;pointer-events:auto;border:2px solid #b8c4ff;background:rgba(105,126,255,.09);box-shadow:0 0 0 2px rgba(15,18,24,.75),0 10px 30px rgba(0,0,0,.25);border-radius:10px;cursor:pointer;padding:0;text-align:left;color:white;outline:none';
        const chip = document.createElement('span');
        chip.style.cssText = 'position:absolute;left:6px;top:6px;max-width:calc(100% - 12px);background:#e2e8ff;color:#111827;border-radius:7px;padding:4px 7px;font:700 11px/1.25 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 4px 16px rgba(0,0,0,.25)';
        chip.textContent = `${c.index + 1}. ${c.label}`;
        box.appendChild(chip);
        box.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation();
          rememberTarget(c.el,c.index);
          removeChooser();
          placeCaretEnd(target);
          resolve({ok:true,automatic:false,count:candidates.length,label:c.label,index:c.index});
        }, true);
        chooserRoot.appendChild(box);
        overlays.push({box,c});
      }

      const update = () => {
        for (const {box,c} of overlays) {
          if (!document.contains(c.el) || !isVisible(c.el)) { box.style.display='none'; continue; }
          const r = c.el.getBoundingClientRect();
          box.style.display='block';
          box.style.left = `${Math.round(r.left)}px`;
          box.style.top = `${Math.round(r.top)}px`;
          box.style.width = `${Math.max(40,Math.round(r.width))}px`;
          box.style.height = `${Math.max(20,Math.round(r.height))}px`;
        }
      };
      update();
      addEventListener('resize', update, true);
      addEventListener('scroll', update, true);

      const finishCancel = () => {
        removeChooser();
        resolve({ok:false,error:'Text-box selection cancelled.'});
      };
      const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); finishCancel(); } };
      addEventListener('keydown', onKey, true);
      cancel.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); finishCancel(); });

      chooserCleanup = () => {
        removeEventListener('resize', update, true);
        removeEventListener('scroll', update, true);
        removeEventListener('keydown', onKey, true);
      };
      document.documentElement.appendChild(chooserRoot);
    });
  }

  function setShield(enabled) {
    if (!enabled) {
      clickShield?.remove();
      clickShield = null;
      return {ok:true};
    }
    if (clickShield && document.contains(clickShield)) return {ok:true};
    clickShield = document.createElement('div');
    clickShield.id = 'fpt5-shield';
    clickShield.style.cssText = 'position:fixed;inset:0;z-index:2147483644;background:transparent;pointer-events:auto;cursor:default';
    clickShield.title = 'Flow Prompt Typer is typing. Page clicks are temporarily ignored so the selected box keeps focus.';
    document.documentElement.appendChild(clickShield);
    return {ok:true};
  }

  function ensureToast() {
    if (toast && document.contains(toast)) return toast;
    toast = document.createElement('div');
    toast.id = 'fpt5-toast';
    toast.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;max-width:520px;padding:11px 13px;border-radius:10px;background:rgba(14,17,22,.97);color:#eef2fa;border:1px solid rgba(160,180,255,.36);box-shadow:0 12px 35px rgba(0,0,0,.38);font:12px/1.45 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;pointer-events:none;white-space:normal';
    document.documentElement.appendChild(toast);
    return toast;
  }

  function showProgress(payload = {}) {
    const el = ensureToast();
    el.textContent = payload.message || 'Flow Prompt Typer is running…';
    el.style.borderColor = payload.phase === 'done'
      ? 'rgba(90,220,140,.55)'
      : payload.phase === 'error'
        ? 'rgba(255,100,100,.62)'
        : 'rgba(160,180,255,.36)';
    if (payload.phase === 'done') setTimeout(() => el.remove(), 5000);
    else if (payload.phase === 'error') setTimeout(() => el.remove(), 10000);
  }

  chrome.runtime.onMessage.addListener((m, _sender, sendResponse) => {
    if (m?.type === 'FPT51_PING') { sendResponse({ok:true,version:VERSION}); return false; }
    if (m?.type === 'FPT51_SCAN') {
      sendResponse({ok:true,targets:scanEditors().map(({el,...rest})=>rest),title:document.title,url:location.href});
      return false;
    }
    if (m?.type === 'FPT51_SELECT_TARGET') { chooseTarget().then(sendResponse); return true; }
    if (m?.type === 'FPT51_FOCUS') { sendResponse(focusTarget()); return false; }
    if (m?.type === 'FPT51_TEXT') { sendResponse({ok:true,text:targetText()}); return false; }
    if (m?.type === 'FPT51_CLEAR_DOM') { sendResponse(clearTargetDom()); return false; }
    if (m?.type === 'FPT51_LOCK') { sendResponse(setShield(Boolean(m.enabled))); return false; }
    if (m?.type === 'FPT51_PROGRESS') { showProgress(m.payload); sendResponse({ok:true}); return false; }
    if (m?.type === 'FPT51_CANCEL_CHOOSER') { removeChooser(); sendResponse({ok:true}); return false; }
    return false;
  });
})();
