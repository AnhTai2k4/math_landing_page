import assert from 'node:assert/strict';
import {validAppearanceRecord} from '../src/components/student-appearance';
const good={profileKey:'8c445b54-05b1-4df6-9013-e90f58169078',revision:2,school:'Trường thử nghiệm',appearance:{avatar:'spark',photo:''}};
assert.equal(validAppearanceRecord(good),true);
for(const value of [null,{...good,profileKey:'name|class'},{...good,revision:-1},{...good,school:undefined},{...good,school:'a'.repeat(161)},{...good,appearance:{avatar:'spark',photo:'https://example.invalid/a.jpg'}},{...good,appearance:{avatar:'spark',photo:'data:image/svg+xml;base64,PHN2Zz4='}},{...good,appearance:{avatar:'unknown',photo:''}}])assert.equal(validAppearanceRecord(value),false);
console.log('Account avatar records require opaque server identity, valid revision/school and an inline JPEG or default avatar. No name-based browser persistence.');
