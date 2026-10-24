const fresh=(at,now)=>Number.isFinite(Date.parse(at))&&Date.parse(at)<=now+60_000&&now-Date.parse(at)<=30*60_000;
export function visitDigest(snapshot,model,{now=Date.now()}={}){
  if(!snapshot||!fresh(snapshot.checkedAt,now))return null;
  const coins=snapshot.assets.filter(a=>a.kind==='alt'&&Number.isFinite(a.price)&&a.price>0&&fresh(a.priceUpdatedAt,now)).map(a=>({id:a.id,price:a.price}));
  if(!coins.length)return null;
  return {version:2,visitedAt:now,checkedAt:snapshot.checkedAt,coins,temperature:model?.score!==null&&Number.isInteger(model?.score)?{value:model.score,at:model.at,scope:model.scope,modelVersion:model.modelVersion}:null};
}
export function validVisit(v){
  try{return v?.version===2&&Number.isFinite(v.visitedAt)&&typeof v.checkedAt==='string'&&Number.isFinite(Date.parse(v.checkedAt))&&Date.parse(v.checkedAt)<=v.visitedAt+60_000&&Array.isArray(v.coins)&&v.coins.length>0&&v.coins.length<=10&&new Set(v.coins.map(c=>c.id)).size===v.coins.length&&v.coins.every(c=>typeof c.id==='string'&&c.id.length>0&&c.id.length<150&&Number.isFinite(c.price)&&c.price>0)&&
    (v.temperature===null||([1,2].includes(v.temperature.modelVersion)&&Number.isInteger(v.temperature.value)&&v.temperature.value>=0&&v.temperature.value<=100&&typeof v.temperature.scope==='string'&&v.temperature.scope.length<40000&&Number.isFinite(v.temperature.at)&&v.temperature.at<=v.visitedAt+60_000));}catch{return false;}
}
export function compareVisit(previous,current){
  if(!validVisit(previous)||!validVisit(current)||previous.visitedAt>=current.visitedAt||Date.parse(current.checkedAt)<Date.parse(previous.checkedAt)||current.visitedAt-previous.visitedAt>30*86_400_000)return null;
  const old=new Map(previous.coins.map(c=>[c.id,c]));
  const matched=current.coins.filter(c=>old.has(c.id)).map(c=>({id:c.id,change:(c.price/old.get(c.id).price-1)*100}));
  return {matched,changed:current.checkedAt!==previous.checkedAt,up:matched.filter(c=>c.change>0).length,down:matched.filter(c=>c.change<0).length,membershipChanged:matched.length!==previous.coins.length||matched.length!==current.coins.length,
    sentimentChange:previous.temperature&&current.temperature&&current.temperature.modelVersion===previous.temperature.modelVersion&&current.temperature.at>=previous.temperature.at&&current.temperature.scope===previous.temperature.scope?current.temperature.value-previous.temperature.value:null};
}
