// 상품(products)의 ecountCode를 pid로 지정해서 설정 (set-client-ecount-code.js의 상품판).
// 실행: node scripts/set-product-ecount-code.js <pid> "<ecountCode>"          (dry-run)
//       node scripts/set-product-ecount-code.js <pid> "<ecountCode>" --apply  (반영)
// 반영 전에 npm run backup -- products 로 백업할 것.
const { db, APPLY } = require('./lib/admin');

const [pid, code] = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!pid || !code) {
  console.error('사용법: node scripts/set-product-ecount-code.js <pid> "<ecountCode>" [--apply]');
  process.exit(1);
}

(async () => {
  const ref = db.collection('products').doc(pid);
  const doc = await ref.get();
  if (!doc.exists) { console.error('products/' + pid + ' 문서가 없습니다.'); process.exit(1); }
  const before = doc.get('ecountCode');
  console.log('문서: products/' + pid + '  (name: ' + doc.get('name') + ')');
  console.log('ecountCode: ' + JSON.stringify(before) + ' → ' + JSON.stringify(code));
  if (before === code) { console.log('이미 같은 값입니다. 변경 없음.'); return; }
  // 같은 코드를 쓰는 다른 상품이 있으면 알려줌 (1단/2단 쌍처럼 의도된 경우도 있어서 막지는 않음)
  const dup = await db.collection('products').where('ecountCode', '==', code).get();
  dup.forEach(d => { if (d.id !== pid) console.log('  참고: 같은 코드를 쓰는 상품 ' + d.id + ' ' + d.get('name')); });
  if (!APPLY) { console.log('[dry-run] 반영하려면 --apply 를 붙여 실행하세요.'); return; }
  await ref.update({ ecountCode: code });
  const after = (await ref.get()).get('ecountCode');
  console.log('반영 완료. 확인한 값: ' + JSON.stringify(after));
})().catch(e => { console.error(e.message); process.exit(1); });
