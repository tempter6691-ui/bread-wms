// 읽기 전용: 키가 제대로 동작하는지 확인하고 컬렉션별 문서 수를 출력.
// 실행: npm run check
const { db } = require('./lib/admin');

(async () => {
  const cols = await db.listCollections();
  console.log('연결 성공 — 프로젝트 bread-wms, 최상위 컬렉션 ' + cols.length + '개');
  for (const c of cols) {
    const snap = await c.count().get();
    console.log('  ' + c.id.padEnd(22) + snap.data().count);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
