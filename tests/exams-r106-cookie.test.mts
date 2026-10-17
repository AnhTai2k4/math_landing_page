import assert from 'node:assert/strict';
import {homeworkCookie,expireLegacyHomeworkCookie} from '../server/btvn/http';
const token='a'.repeat(64),cookie=homeworkCookie(token,true),legacy=expireLegacyHomeworkCookie(true);
assert.match(cookie,/Path=\/api;/);assert.match(cookie,/HttpOnly; SameSite=Strict/);assert.match(cookie,/; Secure$/);assert.match(cookie,/Max-Age=14400/);
assert.match(legacy,/Path=\/api\/btvn;/);assert.match(legacy,/Max-Age=0/);assert.match(homeworkCookie('',true),/Max-Age=0/);
assert.ok(!cookie.includes('Domain='));
console.log('Session cookie covers both private rank and BTVN/avatar; legacy scoped cookie is expired by API response.');
