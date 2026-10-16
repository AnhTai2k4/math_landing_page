import type {PracticeQuestion} from './data';

/** Ảnh nguồn không thay cho văn bản từng ý khi ôn và đối chiếu bằng trình đọc màn hình. */
export function hasReadableTfStatements(question:PracticeQuestion):boolean {
  return question.kind==='tf'&&Array.isArray(question.statements)&&question.statements.length===4&&
    Array.from(question.statements).every(value=>typeof value==='string'&&!!value.trim());
}
