// Firestore Admin SDK 공통 초기화.
// 키 파일 위치: 환경변수 FIREBASE_KEY 또는 프로젝트 루트의 serviceAccountKey.json
// (둘 다 .gitignore 처리되어 있음 — 절대 커밋하지 말 것)
const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue, FieldPath } = require('firebase-admin/firestore');

const EXPECTED_PROJECT = 'bread-wms';
const keyPath = path.resolve(process.env.FIREBASE_KEY || path.join(__dirname, '..', '..', 'serviceAccountKey.json'));

if (!fs.existsSync(keyPath)) {
  console.error('서비스 계정 키 파일이 없습니다: ' + keyPath);
  console.error('Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → "새 비공개 키 생성"으로 받은 JSON을');
  console.error('프로젝트 루트에 serviceAccountKey.json 이름으로 저장하세요.');
  process.exit(1);
}

const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
if (key.project_id !== EXPECTED_PROJECT) {
  console.error('키의 project_id가 "' + key.project_id + '"입니다. "' + EXPECTED_PROJECT + '" 키가 맞는지 확인하세요.');
  process.exit(1);
}

initializeApp({ credential: cert(key) });
const db = getFirestore();

// 쓰기 스크립트는 기본이 dry-run. 실제 반영하려면 --apply 플래그를 붙여 실행.
const APPLY = process.argv.includes('--apply');

module.exports = { db, FieldValue, FieldPath, APPLY };
