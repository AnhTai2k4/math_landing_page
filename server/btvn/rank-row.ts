export function publicRankRow(r:any,maxRank=Number.MAX_SAFE_INTEGER){
 if(!r||!Number.isSafeInteger(r.rank)||r.rank<1||r.rank>maxRank||typeof r.fullName!=='string'||!r.fullName.trim()||r.fullName.length>160||typeof r.className!=='string'||r.className.length>100||typeof r.score!=='number'||!Number.isFinite(r.score)||r.score<0||r.score>10||!Number.isInteger(r.submitted)||!Number.isInteger(r.total)||r.total<1||r.submitted<0||r.submitted>r.total)throw Error('Invalid rank row');
 return {rank:r.rank,fullName:r.fullName,className:r.className,score:r.score,submitted:r.submitted,total:r.total};
}
export function validRankFilter(cohort:unknown,kind:unknown,cls:unknown){return typeof cohort==='string'&&['2K9','2K10','2K11','2K12','2K13','2K14'].includes(cohort)&&typeof kind==='string'&&['btvn-tuan','btvn-thang','kiem-tra-thang'].includes(kind)&&(cls===undefined||cls===null||typeof cls==='string'&&cls.length<=100&&cls.startsWith(cohort+' '));}
