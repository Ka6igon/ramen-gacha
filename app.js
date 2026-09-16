(() => {
  'use strict';
  const KEY = 'ramen-gacha-shops-v1';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  let shops = load(); let map; let markers = []; let selectedPosition = null; let detailShopId = null;
  let selectedFilter = 'all'; let spinning = false; let lastResult = null;

  function load() { try { const d = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(d) ? d.filter(validShop) : []; } catch { return []; } }
  function validShop(s) { return s && typeof s.id === 'string' && typeof s.name === 'string' && ['visited','unvisited'].includes(s.status) && Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(shops)); updateUI(); return true; } catch (e) { alert('データを保存できませんでした。写真やデータの容量を減らしてからもう一度お試しください。'); return false; } }
  function id() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function escapeHtml(t) { const x = document.createElement('div'); x.textContent = t || ''; return x.innerHTML; }
  function dateText(d) { return d ? new Date(`${d}T00:00:00`).toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric'}) : '未記録'; }
  function setScreen(name) { $$('.screen').forEach(x => x.classList.toggle('active', x.id === name)); $$('.nav-item').forEach(x => x.classList.toggle('active', x.dataset.nav === name)); if(name === 'map') setTimeout(() => { initMap(); map.invalidateSize(); }, 50); updateUI(); window.scrollTo({top:0,behavior:'smooth'}); }

  function initMap() {
    if (map) return;
    map = L.map('leaflet-map').setView([35.6812,139.7671], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
    map.on('click', (e) => { selectedPosition = e.latlng; $('#position-note').textContent = `選択位置：${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`; openShopDialog(); }); renderMarkers();
  }
  function pinIcon(status) { return L.divIcon({className:'',html:`<div class="pin ${status === 'visited' ? 'red':'green'}"></div>`,iconSize:[24,24],iconAnchor:[12,24]}); }
  function renderMarkers() { if(!map) return; markers.forEach(m=>m.remove()); markers = shops.map(s => L.marker([s.lat,s.lng],{icon:pinIcon(s.status)}).addTo(map).on('click',()=>showDetail(s.id))); }
  function focusShop(shop) { setScreen('map'); setTimeout(()=>{ map.setView([shop.lat,shop.lng],16); showDetail(shop.id); },100); }

  function updateUI() {
    const visited = shops.filter(s=>s.status==='visited'), unvisited = shops.filter(s=>s.status==='unvisited');
    $('#home-visited').textContent = visited.length; $('#home-unvisited').textContent = unvisited.length; $('#record-unvisited').textContent = unvisited.length;
    const yr = String(new Date().getFullYear()); $('#record-year').textContent = visited.filter(s=>s.visitDate?.startsWith(yr)).length;
    renderList('#visited-list',visited,'訪問済みのお店はまだありません'); renderList('#unvisited-list',unvisited,'行きたいお店はまだありません'); renderMarkers();
  }
  function renderList(selector, list, empty) { const el=$(selector); el.innerHTML=list.length ? list.map(s=>`<button class="shop-row" data-shop="${s.id}">${s.photo?`<img src="${s.photo}" alt="">`:`<span class="row-dot ${s.status==='visited'?'red':'green'}"></span>`}<span><b>${escapeHtml(s.name)}</b><small>${s.status==='visited'?dateText(s.visitDate):'行きたいお店'}</small></span></button>`).join('') : `<p class="hint">${empty}</p>`; el.querySelectorAll('[data-shop]').forEach(b=>b.onclick=()=>showDetail(b.dataset.shop)); }

  function openShopDialog(shop = null, convert = false) {
    const form=$('#shop-form'); form.reset(); $('#form-error').textContent=''; $('#photo-preview').classList.add('hidden');
    $('#shop-id').value=shop?.id || ''; $('#shop-name').value=shop?.name || ''; $('#shop-lat').value=shop?.lat ?? selectedPosition?.lat ?? ''; $('#shop-lng').value=shop?.lng ?? selectedPosition?.lng ?? '';
    const status=convert?'visited':(shop?.status || 'unvisited'); form.elements.status.value=status; $('#shop-date').value=shop?.visitDate || new Date().toISOString().slice(0,10); $('#shop-menu').value=shop?.menu || '';
    if(shop?.photo){$('#photo-preview').src=shop.photo;$('#photo-preview').classList.remove('hidden');}
    $('#form-title').textContent=convert?'訪問を記録':shop?'お店を編集':'お店を登録'; $('#position-note').textContent=$('#shop-lat').value ? `位置を設定済み：${Number($('#shop-lat').value).toFixed(5)}, ${Number($('#shop-lng').value).toFixed(5)}` : '地図をタップして位置を選択してください。'; toggleVisitFields(); $('#shop-dialog').showModal();
  }
  function toggleVisitFields(){ $('#visit-fields').classList.toggle('hidden',$('#shop-form').elements.status.value!=='visited'); }
  async function compressImage(file) { return new Promise((resolve,reject)=>{ if(!file.type.startsWith('image/')) return reject(new Error('画像ファイルを選択してください。')); const reader=new FileReader(); reader.onerror=()=>reject(new Error('写真を読み込めませんでした。')); reader.onload=()=>{const im=new Image();im.onerror=()=>reject(new Error('写真を読み込めませんでした。'));im.onload=()=>{const scale=Math.min(1,1200/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*scale));c.height=Math.max(1,Math.round(im.height*scale));c.getContext('2d').drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.78));};im.src=reader.result;};reader.readAsDataURL(file); }); }
  $('#shop-form').addEventListener('submit', async (e)=>{ e.preventDefault(); const error=$('#form-error'); error.textContent=''; const name=$('#shop-name').value.trim(), lat=Number($('#shop-lat').value), lng=Number($('#shop-lng').value), status=e.currentTarget.elements.status.value;
    if(!name){error.textContent='店名を入力してください。';return;} if(!Number.isFinite(lat)||!Number.isFinite(lng)){error.textContent='地図をタップして店舗位置を指定してください。';return;}
    let existing=shops.find(s=>s.id===$('#shop-id').value); let photo=existing?.photo || null; const file=$('#shop-photo').files[0]; try { if(file) photo=await compressImage(file); } catch(err){error.textContent=err.message;return;}
    const shop={id:existing?.id||id(),name,lat,lng,status,photo,visitDate:status==='visited'?$('#shop-date').value:'',menu:status==='visited'?$('#shop-menu').value.trim():''};
    if(existing) shops=shops.map(s=>s.id===shop.id?shop:s); else shops.push(shop); if(save()){ $('#shop-dialog').close(); selectedPosition=null; }
  });
  $('#shop-photo').addEventListener('change',async e=>{if(!e.target.files[0])return;try{$('#photo-preview').src=await compressImage(e.target.files[0]);$('#photo-preview').classList.remove('hidden');}catch(err){$('#form-error').textContent=err.message;}});
  $$('#shop-form input[name=status]').forEach(r=>r.onchange=toggleVisitFields);
  function showDetail(shopId){const s=shops.find(x=>x.id===shopId);if(!s)return;detailShopId=s.id;$('#detail-name').textContent=s.name; const photo=$('#detail-photo'); photo.classList.toggle('hidden',!s.photo);if(s.photo)photo.src=s.photo;$('#detail-content').innerHTML=s.status==='visited'?`<p class="detail-line">訪問日：${dateText(s.visitDate)}</p><p class="detail-line">食べたメニュー：${escapeHtml(s.menu||'未記録')}</p>`:`<p class="detail-line"><span class="dot green"></span>行きたいお店</p>`;$('#convert-btn').classList.toggle('hidden',s.status==='visited');$('#detail-dialog').showModal();}
  $('#edit-btn').onclick=()=>{const s=shops.find(x=>x.id===detailShopId);$('#detail-dialog').close();openShopDialog(s);}; $('#convert-btn').onclick=()=>{const s=shops.find(x=>x.id===detailShopId);$('#detail-dialog').close();openShopDialog(s,true);}; $('#delete-btn').onclick=()=>{const s=shops.find(x=>x.id===detailShopId);if(s&&confirm(`「${s.name}」を削除しますか？`)){shops=shops.filter(x=>x.id!==s.id);save();$('#detail-dialog').close();}};

  function targetShops(){return selectedFilter==='all'?shops:shops.filter(s=>s.status===selectedFilter);}
  $$('.filter').forEach(b=>b.onclick=()=>{$$('.filter').forEach(x=>x.classList.toggle('active',x===b));selectedFilter=b.dataset.filter;$('#gacha-message').textContent='';$('#result-map-btn').classList.add('hidden');});
  $('#spin-btn').onclick=()=>{const pool=targetShops();if(spinning)return;if(!pool.length){const kind=selectedFilter==='visited'?'訪問済み店舗':selectedFilter==='unvisited'?'未訪問店舗':'店舗';$('#gacha-message').textContent=`${kind}が登録されていません。`;return;}spinning=true;$('#spin-btn').disabled=true;$('#result-map-btn').classList.add('hidden');$('#gacha-message').textContent='';let count=0,delay=55;const winner=pool[Math.floor(Math.random()*pool.length)];function tick(){const s=count>15?winner:pool[Math.floor(Math.random()*pool.length)];$('#slot-name').textContent=s.name;$('#slot-status').textContent=s.status==='visited'?'訪問済み':'未訪問';count++;delay=Math.min(460,delay*1.19);if(count<19)setTimeout(tick,delay);else{spinning=false;lastResult=winner;$('#spin-btn').disabled=false;$('#result-map-btn').classList.remove('hidden');}}tick();};
  $('#result-map-btn').onclick=()=>lastResult&&focusShop(lastResult);

  $('#add-shop-btn').onclick=()=>openShopDialog(); $('#locate-btn').onclick=()=>{if(!navigator.geolocation){alert('このブラウザでは現在地を利用できません。');return;}navigator.geolocation.getCurrentPosition(p=>map.setView([p.coords.latitude,p.coords.longitude],15),()=>alert('現在地を取得できませんでした。位置情報の許可を確認してください。'));};
  $$('[data-nav]').forEach(b=>b.addEventListener('click',()=>setScreen(b.dataset.nav))); $$('[data-close]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).close());
  $('#export-btn').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),shops},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`ramen-gacha-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
  $('#import-input').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onerror=()=>alert('ファイルを読み込めませんでした。');r.onload=()=>{try{const data=JSON.parse(r.result);if(!data||data.version!==1||!Array.isArray(data.shops)||!data.shops.every(validShop))throw new Error();if(!confirm('現在のデータを置き換えてインポートします。よろしいですか？'))return;shops=data.shops;if(save())alert(`${shops.length}件の店舗データを復元しました。`);}catch{alert('不正なJSONファイルです。RAMEN GACHAからエクスポートしたファイルを選択してください。');}finally{e.target.value='';}};r.readAsText(f);};
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{})); updateUI();
})();
