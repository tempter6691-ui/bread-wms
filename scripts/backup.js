// 읽기 전용: 컬렉션을 backups/<타임스탬프>/<컬렉션>.json 으로 저장.
// 쓰기 스크립트를 돌리기 전에 반드시 먼저 실행할 것.
// 실행: npm run backup                   (주요 컬렉션)
//       npm run backup -- products clients (지정한 컬렉션만)
const fs = require('fs');
const path = require('path');
const { db } = require('./lib/admin');

const DEFAULT = ['products', 'clients', 'inventory', 'templates', 'drivers', 'settings', 'recipes', 'ingredientEcountMap'];
const names = process.argv.slice(2).filter(a => !a.startsWith('--'));
const targets = names.length ? names : DEFAULT;

(async () => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(__dirname, '..', 'backups', stamp);
  fs.mkdirSync(dir, { recursive: true });
  for (const name of targets) {
    const snap = await db.collection(name).get();
    const out = {};
    snap.forEach(d => { out[d.id] = d.data(); });
    fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(out, null, 2));
    console.log('  ' + name.padEnd(22) + snap.size + '건');
  }
  console.log('백업 완료: ' + dir);
})().catch(e => { console.error(e.message); process.exit(1); });
