// 상품(products) 문서의 필드를 pid로 지정해서 설정. 지정한 필드만 update하고 나머지는 건드리지 않음.
// 값은 JSON으로 해석(true/false/숫자), 해석 안 되면 문자열.
// 실행: node scripts/set-product-fields.js P157 bmMult=2                    (dry-run)
//       node scripts/set-product-fields.js P040,P042 noStock=true --apply    (반영)
// 반영 전에 npm run backup -- products 로 백업할 것.
const { db, APPLY } = require('./lib/admin');

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const pids = (args[0] || '').split(',').map(s => s.trim()).filter(Boolean);
const fields = {};
args.slice(1).forEach(a => {
  const i = a.indexOf('=');
  if (i <= 0) return;
  const raw = a.slice(i + 1);
  let v; try { v = JSON.parse(raw); } catch (e) { v = raw; }
  fields[a.slice(0, i)] = v;
});
// 복원 원칙과 같은 이유로, 이 스크립트로는 이름/이카운트 연결 필드를 바꾸지 않음
const BLOCKED = ['name', 'ecountCode', 'ecountQtyMultiplier', 'orderUnitDivisor', 'qr'];
if (!pids.length || !Object.keys(fields).length) {
  console.error('사용법: node scripts/set-product-fields.js <pid[,pid...]> 필드=값 [필드=값...] [--apply]');
  process.exit(1);
}
const blocked = Object.keys(fields).filter(k => BLOCKED.includes(k));
if (blocked.length) { console.error('이 스크립트로는 바꾸지 않는 필드: ' + blocked.join(', ')); process.exit(1); }

(async () => {
  const refs = pids.map(id => db.collection('products').doc(id));
  const snaps = await db.getAll(...refs);
  const missing = snaps.filter(s => !s.exists).map(s => s.id);
  if (missing.length) { console.error('없는 상품: ' + missing.join(', ')); process.exit(1); }
  const changes = [];
  snaps.forEach(s => {
    const d = s.data(), diff = {};
    Object.keys(fields).forEach(k => { if (JSON.stringify(d[k]) !== JSON.stringify(fields[k])) diff[k] = fields[k]; });
    const desc = Object.keys(fields).map(k => k + ': ' + JSON.stringify(d[k]) + ' → ' + JSON.stringify(fields[k])).join(', ');
    console.log((Object.keys(diff).length ? '  변경 ' : '  같음 ') + s.id.padEnd(8) + ' ' + d.name + '  ' + desc);
    if (Object.keys(diff).length) changes.push({ ref: s.ref, diff });
  });
  console.log('변경 ' + changes.length + '건 / 대상 ' + snaps.length + '건');
  if (!changes.length) return;
  if (!APPLY) { console.log('[dry-run] 반영하려면 --apply 를 붙여 실행하세요.'); return; }
  const batch = db.batch();
  changes.forEach(c => batch.update(c.ref, c.diff));
  await batch.commit();
  console.log('반영 완료.');
})().catch(e => { console.error(e.message); process.exit(1); });
