// 요일 템플릿(templates)에서 상품 pid를 다른 pid로 바꿈 (안 쓰는 중복 상품 정리용).
// 이미 새 pid가 들어 있는 거래처는 옛 pid만 빼서 중복이 생기지 않게 함. 바뀌는 거래처 필드만 update.
// 실행: node scripts/replace-template-pid.js <옛pid> <새pid>          (dry-run)
//       node scripts/replace-template-pid.js <옛pid> <새pid> --apply  (반영)
// 반영 전에 npm run backup -- templates 로 백업할 것.
const { db, FieldPath, APPLY } = require('./lib/admin');

const [from, to] = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!from || !to || from === to) {
  console.error('사용법: node scripts/replace-template-pid.js <옛pid> <새pid> [--apply]');
  process.exit(1);
}

(async () => {
  const [pf, pt] = await db.getAll(db.collection('products').doc(from), db.collection('products').doc(to));
  if (!pt.exists) { console.error('새 pid ' + to + ' 상품이 없습니다.'); process.exit(1); }
  console.log(from + ' (' + (pf.exists ? pf.get('name') : '상품 없음') + ') → ' + to + ' (' + pt.get('name') + ')');
  const snap = await db.collection('templates').get();
  const updates = [];
  snap.forEach(doc => {
    Object.entries(doc.data()).forEach(([client, arr]) => {
      if (!Array.isArray(arr) || !arr.includes(from)) return;
      const next = arr.includes(to) ? arr.filter(p => p !== from) : arr.map(p => (p === from ? to : p));
      console.log('  ' + doc.id + ' / ' + client + ': ' + (arr.includes(to) ? from + ' 제거(' + to + ' 이미 있음)' : from + ' → ' + to) +
        '  [' + arr.length + '개 → ' + next.length + '개]');
      updates.push({ ref: doc.ref, client, next });
    });
  });
  console.log('변경 ' + updates.length + '건');
  if (!updates.length) return;
  if (!APPLY) { console.log('[dry-run] 반영하려면 --apply 를 붙여 실행하세요.'); return; }
  const batch = db.batch();
  updates.forEach(u => batch.update(u.ref, new FieldPath(u.client), u.next));
  await batch.commit();
  console.log('반영 완료.');
})().catch(e => { console.error(e.message); process.exit(1); });
