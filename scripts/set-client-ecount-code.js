// 거래처(clients)의 ecountCode를 이름으로 찾아 설정.
// 실행: node scripts/set-client-ecount-code.js "<거래처명>" "<ecountCode>"          (dry-run)
//       node scripts/set-client-ecount-code.js "<거래처명>" "<ecountCode>" --apply  (반영)
// 반영 전에 npm run backup -- clients 로 백업할 것.
const { db, APPLY } = require('./lib/admin');

const [name, code] = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!name || !code) {
  console.error('사용법: node scripts/set-client-ecount-code.js "<거래처명>" "<ecountCode>" [--apply]');
  process.exit(1);
}

(async () => {
  const snap = await db.collection('clients').where('name', '==', name).get();
  if (snap.size !== 1) {
    console.error('name == "' + name + '" 문서가 ' + snap.size + '건입니다. 정확히 1건일 때만 진행합니다.');
    snap.forEach(d => console.error('  ' + d.id + '  ' + JSON.stringify(d.data())));
    process.exit(1);
  }
  const doc = snap.docs[0];
  const before = doc.get('ecountCode');
  console.log('문서: clients/' + doc.id + '  (name: ' + doc.get('name') + ', code: ' + doc.get('code') + ')');
  console.log('ecountCode: ' + JSON.stringify(before) + ' → ' + JSON.stringify(code));
  if (before === code) { console.log('이미 같은 값입니다. 변경 없음.'); return; }
  if (!APPLY) { console.log('[dry-run] 반영하려면 --apply 를 붙여 실행하세요.'); return; }
  await doc.ref.update({ ecountCode: code });
  const after = (await doc.ref.get()).get('ecountCode');
  console.log('반영 완료. 확인한 값: ' + JSON.stringify(after));
})().catch(e => { console.error(e.message); process.exit(1); });
