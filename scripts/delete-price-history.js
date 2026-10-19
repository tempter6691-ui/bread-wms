// priceHistory 중복 문서 삭제 (같은 거래처+상품에 단가 문서가 여러 개라 어떤 단가가 쓰일지 불확실했던 것 정리용).
// 인자: 지울문서ID:거래처ID:pid:단가  (반영 직전에 다시 읽어서 셋 다 일치할 때만 지움 — 그 사이 바뀌었으면 건너뜀)
// 실행: node scripts/delete-price-history.js <id>:<clientDocId>:<pid>:<price> ...           (dry-run)
//       node scripts/delete-price-history.js ... --apply                                    (반영)
// 2026-10-19: --apply 시 지울 문서만 backups/<타임스탬프>/priceHistory-deleted.json 에 먼저 저장함
// (몇 건 지우자고 priceHistory 전체(3,400건)를 매번 백업하다 일일 읽기 한도를 넘긴 일이 있었음)
const fs = require('fs');
const path = require('path');
const { db, APPLY } = require('./lib/admin');

const specs = process.argv.slice(2).filter(a => !a.startsWith('--')).map(s => {
  const [id, clientDocId, pid, price] = s.split(':');
  return { id, clientDocId, pid, price: Number(price) };
});
if (!specs.length || specs.some(s => !s.id || !s.clientDocId || !s.pid || isNaN(s.price))) {
  console.error('사용법: node scripts/delete-price-history.js <문서ID>:<거래처ID>:<pid>:<단가> ... [--apply]');
  process.exit(1);
}

(async () => {
  const snaps = await db.getAll(...specs.map(s => db.collection('priceHistory').doc(s.id)));
  const del = [];
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i], snap = snaps[i];
    if (!snap.exists) { console.log('  건너뜀 ' + s.id + ' — 문서 없음'); continue; }
    const d = snap.data();
    if (d.clientDocId !== s.clientDocId || d.pid !== s.pid || d.price !== s.price) {
      console.log('  건너뜀 ' + s.id + ' — 예상과 다름: ' + JSON.stringify(d)); continue;
    }
    // 같은 거래처+상품에 남는 문서가 최소 1개는 있어야 지움 (단가가 통째로 사라지지 않게)
    const rest = await db.collection('priceHistory').where('clientDocId', '==', s.clientDocId).where('pid', '==', s.pid).get();
    const remain = rest.docs.filter(x => x.id !== s.id && !specs.some(o => o.id === x.id));
    if (!remain.length) { console.log('  건너뜀 ' + s.id + ' — 지우면 이 거래처+상품 단가가 하나도 안 남음'); continue; }
    console.log('  삭제 ' + s.id.padEnd(22) + ' ' + s.clientDocId + ' ' + s.pid + ' ' + d.price +
      '   → 남는 문서: ' + remain.map(x => x.id + '=' + x.get('price') + (x.get('priceVatIncluded') ? '(VAT포함 ' + x.get('priceVatIncluded') + ')' : '')).join(', '));
    del.push({ ref: snap.ref, data: d });
  }
  console.log('삭제 ' + del.length + '건 / 요청 ' + specs.length + '건');
  if (!del.length) return;
  if (!APPLY) { console.log('[dry-run] 반영하려면 --apply 를 붙여 실행하세요.'); return; }
  const dir = path.join(__dirname, '..', 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(dir, { recursive: true });
  const out = {}; del.forEach(x => { out[x.ref.id] = x.data; });
  fs.writeFileSync(path.join(dir, 'priceHistory-deleted.json'), JSON.stringify(out, null, 2));
  console.log('지울 문서 백업: ' + path.join(dir, 'priceHistory-deleted.json'));
  const batch = db.batch();
  del.forEach(x => batch.delete(x.ref));
  await batch.commit();
  console.log('반영 완료.');
})().catch(e => { console.error(e.message); process.exit(1); });
