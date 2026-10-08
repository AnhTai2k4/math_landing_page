import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PRACTICE_EXAMS,readyExams,validatePracticeExam} from '../src/native/exams/data.ts';
import {scoreAssessment} from '../src/native/exams/assessment.ts';
import {fetchQuestionPdf} from '../src/native/exams/pdf-source.ts';

test('two independently reviewed pilots load as strict 12-4-6 papers with question-only asset hashes',()=>{
  assert.equal(PRACTICE_EXAMS.length,2);assert.equal(readyExams(PRACTICE_EXAMS).length,2);
  for(const exam of PRACTICE_EXAMS){
    assert.equal(validatePracticeExam(exam).valid,true);
    assert.deepEqual(exam.questions.map(q=>q.kind),[...Array(12).fill('mc'),...Array(4).fill('tf'),...Array(6).fill('short')]);
    const pdf=exam.sourcePdf!;const bytes=readFileSync(new URL('../public/exam-assets/'+pdf.sha256+'.pdf',import.meta.url));
    assert.equal(bytes.length,pdf.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),pdf.sha256);
  }
});
test('generic binary MIME is accepted only for immutable exact MTM public asset and verified bytes',async()=>{
  const bytes=Buffer.from('%PDF-test');const hash=createHash('sha256').update(bytes).digest('hex');
  const file={url:'https://raw.githubusercontent.com/AnhTai2k4/math_landing_page/'+'b'.repeat(40)+'/public/exam-assets/'+hash+'.pdf',verified:true as const,sha256:hash,bytes:bytes.length,totalPages:1,questionPages:[1]};
  const fetcher=(async()=>new Response(bytes,{headers:{'content-type':'application/octet-stream'}})) as typeof fetch;
  assert.deepEqual(Buffer.from(await fetchQuestionPdf(file,new AbortController().signal,fetcher)),bytes);
  await assert.rejects(fetchQuestionPdf({...file,url:'https://example.com/'+hash+'.pdf'},new AbortController().signal,fetcher),/PDF hợp lệ/);
  const corrupt=(async()=>new Response(Buffer.from('%PDF-badd'),{headers:{'content-type':'application/octet-stream'}})) as typeof fetch;
  await assert.rejects(fetchQuestionPdf(file,new AbortController().signal,corrupt),/không khớp/);
});
test('reviewed keys give ten points, unanswered zero and reject unknown question ids',()=>{
  for(const exam of PRACTICE_EXAMS){
    const answers=Object.fromEntries(exam.questions.map(q=>[q.id,q.kind==='short'?q.acceptedAnswers[0].replace('.',','):q.answer]));
    const full=scoreAssessment(exam,answers);assert.equal(full.ok,true);if(full.ok)assert.equal(full.earnedMillipoints,10000);
    const empty=scoreAssessment(exam,{});assert.equal(empty.ok,true);if(empty.ok)assert.equal(empty.earnedMillipoints,0);
    assert.equal(scoreAssessment(exam,{unknown:'A'}).ok,false);
  }
});
