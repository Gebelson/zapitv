/* Run manually in your authenticated ZapiTV console. No upload or persistent storage. */
(() => {
  'use strict';
  if (location.origin !== 'https://zapitv-stream.vercel.app') throw new Error('Open the authorized ZapiTV production origin first');
  window.zapiP0Diag?.stop?.();
  const started = Date.now(), events = [], cleanups = [], seen = new WeakSet();
  let active = true, phase = 'initial', providers = [], sequence = 0;
  const safeId = value => typeof value === 'string' && /^[a-z0-9_-]{1,80}$/i.test(value) ? value : 'unknown';
  const record = event => { if (active && events.length < 300) events.push({ms:Date.now()-started,phase,...event}); };
  const endpoint = input => {
    try {
      const u = new URL(typeof input === 'string' ? input : input.url || String(input), location.origin);
      if (u.origin === location.origin) {
        if (u.pathname === '/api/providers/config') return 'provider-config';
        if (u.pathname === '/api/proxy') return 'metadata-proxy';
        if (u.pathname === '/api/auth/me') return 'auth-session';
        const addon = u.pathname.match(/^\/api\/stremio\/([a-z0-9_-]+)\//i);
        if (addon) return `addon:${safeId(addon[1])}`;
        if (u.pathname.startsWith('/api/')) return 'other-api';
      }
      return 'external-or-media';
    } catch { return 'unknown'; }
  };
  async function inspect(response, kind, request) {
    if (kind !== 'provider-config' && kind !== 'metadata-proxy' && !kind.startsWith('addon:')) return;
    if (!response.headers.get('content-type')?.includes('json')) return;
    const reader = response.clone().body?.getReader();
    if (!reader) return;
    let bytes = 0, text = ''; const decoder = new TextDecoder();
    try {
      while (active) {
        const part = await reader.read(); if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 100000) { record({request,kind,result:'BODY_LIMIT'}); return; }
        text += decoder.decode(part.value,{stream:true});
      }
      if (!active) return;
      const data = JSON.parse(text + decoder.decode());
      if (kind === 'provider-config' && Array.isArray(data.providers)) {
        providers = data.providers.slice(0,80).map(p=>({
          id:safeId(p.id),enabled:p.enabled===true,isEligible:p.isEligible===true,
          status:safeId(p.status),healthState:safeId(p.healthState),requiresConfig:p.requiresConfig===true,
          priority:Number.isFinite(p.priority)?p.priority:null
        }));
        record({request,kind,result:'CONFIG_RECEIVED',providers:providers.map(p=>({...p}))});
      }
      if (Array.isArray(data.streams)) record({request,kind,result:'STREAM_RESPONSE',received:data.streams.length});
    } catch { record({request,kind,result:'JSON_NOT_OBSERVED'}); }
    finally { reader.cancel().catch(()=>{}); }
  }
  const originalFetch = window.fetch;
  const wrappedFetch = async function(...args) {
    const request=++sequence, kind=endpoint(args[0]), start=Date.now();
    try {
      const response=await originalFetch.apply(this,args);
      record({request,kind,http:response.status,durationMs:Date.now()-start});
      void inspect(response,kind,request);
      return response;
    } catch(error) {
      record({request,kind,result:error?.name==='AbortError'?'CANCELLED':error?.name==='TimeoutError'?'TIMEOUT':'FETCH_FAILED',durationMs:Date.now()-start});
      throw error;
    }
  };
  window.fetch=wrappedFetch;
  const metrics = (video,event) => record({kind:'video',event,
    time:Math.round(video.currentTime*10)/10,width:video.videoWidth,height:video.videoHeight,
    paused:video.paused,readyState:video.readyState,errorCode:video.error?.code??null,
    frames:video.getVideoPlaybackQuality?.().totalVideoFrames??null,
    dropped:video.getVideoPlaybackQuality?.().droppedVideoFrames??null
  });
  let videos=0;
  const attach = () => {
    for(const video of document.querySelectorAll('video')) {
      if(seen.has(video)||videos>=32)continue;seen.add(video);videos++;
      for(const event of ['loadedmetadata','playing','waiting','stalled','error','ended','seeking','seeked']) {
        const listener=()=>metrics(video,event);video.addEventListener(event,listener);
        cleanups.push(()=>video.removeEventListener(event,listener));
      }
    }
  };
  const observer = new MutationObserver(attach);
  observer.observe(document,{childList:true,subtree:true});attach();
  const interval=setInterval(()=>{attach();for(const v of document.querySelectorAll('video'))metrics(v,'sample');},1000);
  const timer=setTimeout(stop,180000);
  function stop() {
    if(!active)return;active=false;clearTimeout(timer);clearInterval(interval);observer.disconnect();
    for(const cleanup of cleanups)cleanup();
    if(window.fetch===wrappedFetch)window.fetch=originalFetch;
  }
  function snapshot() { return {
    version:1,active,limits:{maxEvents:300,maxDurationSeconds:180,maxJsonBytes:100000},
    providers:providers.map(p=>({...p})),events:events.map(e=>({...e})),
    unobserved:['internal rejection reasons','internal cache/circuit state','XHR status','external provider association','selected source identity','content versus intro identity']
  }; }
  window.zapiP0Diag={stop,snapshot,
    mark(label){phase=safeId(label);record({kind:'mark'});},
    download(){
      const blob=new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='zapitv-p0-session.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
  };
  record({kind:'started'});
  void window.fetch('/api/providers/config').catch(()=>{});
})();
