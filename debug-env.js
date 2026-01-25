import dotenv from 'dotenv';
import path from 'path';

console.log('CWD:', process.cwd());

const e2ePath = path.resolve(process.cwd(), '.env.e2e');
const envPath = path.resolve(process.cwd(), '.env');

console.log('Loading .env.e2e from:', e2ePath);
const e2eResult = dotenv.config({ path: e2ePath });
console.log('e2e error:', e2eResult.error);
console.log('e2e parsed:', e2eResult.parsed);

console.log('Loading .env from:', envPath);
const envResult = dotenv.config({ path: envPath });
console.log('env error:', envResult.error);
console.log('env parsed:', envResult.parsed);

console.log('E2E_TEST_EMAIL:', process.env.E2E_TEST_EMAIL);
