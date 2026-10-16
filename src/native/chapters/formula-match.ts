import {recallDecks,type RecallCard,type RecallDeck} from './quick-recall';

// Bộ nhiễu được rà riêng theo tên thẻ, không tự ghép chủ đề bất kỳ trong kho.
const selected:Record<string,string[]>={
  'g10-c1':['implication','equivalence','subset-count','intervals','venn-three'],
  'g10-c3':['special-sin','special-cos','cosine','sine','heron'],
  'g11-c1-foundation01':['units','arc','sin-add','cos-add','sum-product-cos'],
  'g11-c1-foundation02':['parity','period','monotonic','sin-special','cos-special'],
  'g12-c1':['derivative-trig','derivative-exp','extrema','vertical','tangent'],
};
export type FormulaQuestion={card:RecallCard;choices:{id:string;topic:string}[]};
export function formulaDecks(track:string):RecallDeck[]{
  return recallDecks(track).flatMap(deck=>{
    const ids=selected[deck.id];if(!ids)return [];
    const cards=ids.map(id=>deck.cards.find(card=>card.id===deck.id+':'+id));
    if(cards.some(card=>!card)||new Set(cards.map(card=>card!.topic)).size!==ids.length)return [];
    return [{...deck,cards:cards as RecallCard[]}];
  });
}
export function formulaRound(deck:RecallDeck,round=0):FormulaQuestion[]{
  const n=deck.cards.length;if(n<3)return [];
  const turn=Number.isSafeInteger(round)&&round>=0?round:0;
  return deck.cards.map((_,i)=>{
    const index=(i+turn%n)%n,card=deck.cards[index];
    const choices=[deck.cards[(index+1)%n],deck.cards[(index+2+(turn+i)%(n-2))%n]];
    choices.splice((turn+i)%3,0,card);
    return {card,choices:choices.map(({id,topic})=>({id,topic}))};
  });
}
