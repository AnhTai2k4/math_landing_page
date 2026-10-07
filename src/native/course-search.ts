import {normal,type Chapter} from '../migration/catalogue';

const searchText=(value:string)=>normal(value).replace(/\s+/g,' ');

// Keep source chapters and lesson identities intact; assign ordinals before filtering.
// Search expansion is derived, so clearing never rewrites the saved accordion state.
export function courseSearch(sections:readonly Chapter[],query:string,opened:ReadonlySet<string>){
 const term=searchText(query),searching=term.length>0;
 const chapters=sections.map(chapter=>({
  chapter,
  expanded:searching||opened.has(chapter.id),
  lessons:chapter.lessons.map((lesson,index)=>({lesson,ordinal:index+1}))
   .filter(({lesson})=>!searching||searchText(lesson.title+' '+lesson.subtitle).includes(term)),
 })).filter(({lessons})=>!searching||lessons.length>0);
 return {searching,chapters,matchCount:chapters.reduce((sum,item)=>sum+item.lessons.length,0)};
}
