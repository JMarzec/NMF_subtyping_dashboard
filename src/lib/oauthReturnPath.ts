export function oauthReturnPath(value:unknown):string{
  if(typeof value!=="string"||!value.startsWith("/")||value.startsWith("//")||value.includes("\\")||Array.from(value).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127))return "/";
  try{const url=new URL(value,"https://app.invalid");return url.origin==="https://app.invalid"&&!url.pathname.startsWith("//")?url.pathname+url.search+url.hash:"/";}catch{return "/";}
}