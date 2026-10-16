import theoryTables from './theory-tables.json';

type RecallContext={topic:string;formulaLines:string[];usageLines:string[]};
export type RecallCard={id:string;topic:string;formulaLines:string[];usageLines:string[];context:RecallContext[];notes:string[]};
export type RecallDeck={id:string;title:string;grade:number;chapter:number;cards:RecallCard[]};

// Một số dòng trong bảng dùng ký hiệu của dòng trước. Thẻ rời phải mang theo đúng định nghĩa đó.
const dependencies:Record<string,Record<string,string[]>>={
  'g10-c3':Object.fromEntries(['cosine','sine','area','heron','two-solutions','median'].map(id=>[id,['notation']])),
  'g12-c1':{'cubic-limits':['cubic'],'cubic-symmetry':['cubic'],'linear-asymptotes':['linear-rational'],'quadratic-extrema':['quadratic-rational']},
};

/** Giữ nguyên cả công thức, điều kiện và lưu ý của bảng lý thuyết hiện có. */
export function recallDecks(track:string):RecallDeck[]{
  return theoryTables.tables.filter(table=>String(table.grade)===track).map(table=>({
    id:table.id,title:table.title,grade:table.grade,chapter:table.chapter,
    cards:table.rows.map(row=>({id:table.id+':'+row.id,topic:row.topic,formulaLines:[...row.formulaLines],usageLines:[...row.usageLines],
      context:(dependencies[table.id]?.[row.id]??[]).map(id=>{const source=table.rows.find(item=>item.id===id);if(!source)throw Error('Thiếu định nghĩa của thẻ '+row.id);return {topic:source.topic,formulaLines:[...source.formulaLines],usageLines:[...source.usageLines]};}),
      notes:table.id==='g10-c3'&&row.id==='median'?['$m_a$ là độ dài trung tuyến đến cạnh $a$.']:table.id==='g10-c3'&&row.id==='area'?['$h_a$ là độ dài đường cao ứng với cạnh $a$.']:[],
    })),
  }));
}

export const recallBatch=(deck:RecallDeck,offset:number)=>deck.cards.slice(offset,offset+5);
