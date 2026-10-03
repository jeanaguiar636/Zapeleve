export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const url = req.method === 'GET' ? req.query.url : req.body?.url;
  if (!isAllowedUrl(url)) return res.status(400).json({ error:'Informe uma URL válida do Mercado Livre', products:[] });
  try {
    const response = await fetch(url,{redirect:'follow',headers:browserHeaders()});
    if(!response.ok) return res.status(200).json({originalUrl:url,error:`Não foi possível acessar o link (status ${response.status})`,products:[]});
    const html=await response.text(); let products=[];
    // Página de UM produto: lê só o produto (a página também tem cards de "relacionados", que não devem entrar)
    if(isProductPage(html,response.url)){ const one=extractSingle(html,response.url); products = one ? [one] : extractProducts(html); }
    else { products=extractProducts(html); if(!products.length){ const one=extractSingle(html,response.url); if(one) products.push(one); } }
    return res.status(200).json({originalUrl:url,finalUrl:response.url,total:products.length,products});
  } catch(err){return res.status(200).json({originalUrl:url,error:err.message,products:[]});}
}
function isProductPage(html,url){
  if(/class="[^"]*ui-pdp-title/.test(html)) return true;
  try{ const p=new URL(url).pathname; return /\/(?:p|up)\/MLBU?\d+/i.test(p) || /(^|\/)MLB-?\d{7,}/i.test(p); }catch{ return false; }
}
function extractSingle(html,finalUrl){
  const meta=(prop)=>first(html,new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`,'i'))||first(html,new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`,'i'));
  let title=meta('og:title')||first(html,/<h1[^>]*class="[^"]*ui-pdp-title[^"]*"[^>]*>([^<]+)</i);
  if(!title) return null;
  title=clean(title).replace(/\s*[|\-–]\s*Mercado\s?Livre.*$/i,'').trim();
  let image=meta('og:image');
  image=image?decode(image):extractImage(html);
  if(image) image=image.replace(/-[A-Z]\.(jpg|jpeg|png|webp)/i,'-F.$1');
  const price=normalizePrice(
    first(html,/itemprop=["']price["'][^>]*content=["']([\d.,]+)["']/i)||
    first(html,/content=["']([\d.,]+)["'][^>]*itemprop=["']price["']/i)||
    first(html,/["']price["']\s*:\s*([0-9]+(?:\.[0-9]+)?)/i)
  )||extractPrice(html);
  return {nome:title,preco:price,linkProduto:finalUrl||'',linkImagem:image||''};
}
function extractProducts(html){
  let blocks=split(html,/<div class="poly-card[^"]*"/g); if(!blocks.length) blocks=split(html,/<li class="ui-search-layout__item[^"]*"/g);
  const out=[],seen=new Set();
  for(const b of blocks){
    const title=first(b,/class="poly-component__title"[^>]*>([^<]+)</)||first(b,/class="ui-search-item__title"[^>]*>([^<]+)</);
    let link=first(b,/class="poly-component__title"[^>]*href="([^"]+)"/)||first(b,/href="([^"]+)"[^>]*class="poly-component__title"/)||first(b,/class="ui-search-link"[^>]*href="([^"]+)"/)||first(b,/<a[^>]*href="(https:\/\/[^\"]*mercadolivre\.com\.br[^\"]*)"/);
    const price=extractPrice(b);
    if(!title||!link) continue; link=decode(link); const key=link.split('#')[0]; if(seen.has(key))continue; seen.add(key);
    let image=extractImage(b); if(image)image=decode(image).replace(/-[A-Z]\.(jpg|jpeg|png|webp)/i,'-F.$1');
    out.push({nome:clean(title),preco:price,linkProduto:link.startsWith('http')?link:`https://www.mercadolivre.com.br${link}`,linkImagem:image||''});
  } return out;
}
function extractPrice(block){
  const fraction=first(block,/class=["'][^"']*andes-money-amount__fraction[^"']*["'][^>]*>([\d.,]+)/i);
  const cents=first(block,/class=["'][^"']*andes-money-amount__cents[^"']*["'][^>]*>(\d+)/i);
  if(fraction){
    let value=fraction.replace(/\./g,'').replace(',','.');
    if(cents&&!value.includes('.'))value+='.'+cents.padEnd(2,'0').slice(0,2);
    return normalizePrice(value);
  }
  const candidates=[
    first(block,/itemprop=["']price["'][^>]*content=["']([\d.,]+)["']/i),
    first(block,/content=["']([\d.,]+)["'][^>]*itemprop=["']price["']/i),
    first(block,/["']price["']\s*:\s*([0-9]+(?:\.[0-9]+)?)/i),
    first(block,/["']amount["']\s*:\s*([0-9]+(?:\.[0-9]+)?)/i),
    first(block,/aria-label=["'][^"']*R\$\s*([\d.,]+)/i)
  ];
  for(const value of candidates){const price=normalizePrice(value);if(price)return price;}
  return '';
}
function normalizePrice(value){
  let s=String(value||'').replace(/[^0-9.,]/g,'');
  if(!s)return '';
  if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  else if(s.includes(','))s=s.replace(',','.');
  const n=Number(s);return Number.isFinite(n)&&n>0?n.toFixed(2):'';
}
function split(html,re){const marks=[];let m;while((m=re.exec(html))!==null)marks.push(m.index);return marks.map((x,i)=>html.slice(x,marks[i+1]??Math.min(x+9000,html.length)));}
function extractImage(block){
  // As páginas do ML podem entregar URLs normais, com barras escapadas,
  // entidades HTML ou sequências unicode dentro de JSON.
  const normalized=block
    .replace(/\\u002[fF]/g,'/')
    .replace(/\\\//g,'/')
    .replace(/&quot;|&#34;/g,'"')
    .replace(/&amp;/g,'&');
  const matches=normalized.match(/https?:\/\/[^"'\\s<>),]+\.mlstatic\.com\/[^"'\\s<>),]+/gi);
  if(!matches||!matches.length)return '';
  const valid=matches
    .map(u=>u.replace(/[?&](?:amp;)?$/,'').trim())
    .filter(u=>!/1X1|pixel|sprite|logo/i.test(u));
  return valid.find(u=>/D_(?:NQ|Q)_(?:NP_)?(?:2X_)?\d/i.test(u))||valid[0]||'';
}
function first(s,re){return s.match(re)?.[1]||'';} function decode(s){return s.replace(/&amp;/g,'&');}
function clean(s=''){return decode(s).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();}
function cors(res){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');}
function browserHeaders(){return {'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36','Accept-Language':'pt-BR,pt;q=0.9','Accept':'text/html,application/xhtml+xml'};}
function isAllowedUrl(value){try{const u=new URL(value);return u.protocol==='https:' && (/(^|\.)mercadolivre\.com(\.br)?$/i.test(u.hostname) || u.hostname.toLowerCase()==='meli.la');}catch{return false;}}
