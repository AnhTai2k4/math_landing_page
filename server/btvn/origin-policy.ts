/** Chỉ tên miền chính hoặc hostname của chính deployment Preview được Vercel cấp. */
export function allowedBtvnOrigin(origin:string,env:Record<string,string|undefined>){
 if(['https://minhthanhmath.vn','https://www.minhthanhmath.vn'].includes(origin))return true;
 const host=env.VERCEL_URL;
 return env.VERCEL==='1'&&env.VERCEL_ENV==='preview'&&typeof host==='string'&&/^[a-z0-9-]+\.vercel\.app$/.test(host)&&origin===`https://${host}`;
}
