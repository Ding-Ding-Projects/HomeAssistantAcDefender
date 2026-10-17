import {build} from 'esbuild';
import {readFile,writeFile,cp,mkdir,readdir,stat,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {articleUrl} from './catalog-path.mjs';
import {load} from 'cheerio';
const source = resolve(process.env.DOCS_SITE_DIR || 'site');
const target = resolve('app/site');
const pkg = JSON.parse(await readFile('package.json','utf8'));
await stat(resolve(source,'index.html')).catch(()=>{throw Error('Build the Jekyll site first; see README.md. DOCS_SITE_DIR must name its output.');});
await rm(target,{recursive:true,force:true});
await mkdir(target,{recursive:true});
await cp(source,target,{recursive:true});
const wiki = (await readdir('../docs/wiki')).filter(x=>x.endsWith('.md'));
const articles=[];
async function walk(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){const file=resolve(dir,entry.name);out.push(...(entry.isDirectory()?await walk(file):[file]));}return out;}
for(const file of (await walk(target)).filter(x=>x.endsWith('.html'))){
 const $=load(await readFile(file,'utf8'));
 $('script,iframe,object,embed,form,button,input,select,dialog,[role=dialog],.language-desk').remove();
 $('*').each((_i,el)=>{for(const attr of Object.keys(el.attribs || {}))if(attr.startsWith('on'))$(el).removeAttr(attr);});
 $('[href],[src]').each((_i,el)=>{for(const attr of ['href','src']){let value=$(el).attr(attr);if(!value)continue;
 if(value.startsWith('/HomeAssistantAcDefender/'))value=value.slice('/HomeAssistantAcDefender'.length);
 if(value.startsWith('/'))value='/site'+value;
 if(value.endsWith('.md'))value=value.slice(0,-3)+'.html';
 if(/^(https?:|mailto:|javascript:|\/\/)/i.test(value)){ if(attr==='href'){$(el).removeAttr('href').attr('title','External reference unavailable offline').attr('aria-disabled','true');}else $(el).removeAttr(attr); }
 else $(el).attr(attr,value);
 }});
 $('head').append('<style>@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important;transition:none!important}}body{overflow-wrap:anywhere}pre{max-width:100%;overflow:auto}img{max-width:100%}.masthead-note{white-space:normal!important;min-width:0;overflow-wrap:anywhere}</style>');
 await writeFile(file,$.html());
 const url = articleUrl(target,file);
 if(url) articles.push({path:url,title:$('h1').first().text() || $('title').text(),text:$('main').text() || $('body').text()});
}
for(const name of wiki)if(!articles.some(x=>x.path===`site/wiki/${name.slice(0,-3)}.html`))throw Error('Missing rendered article: '+name);
const version=process.env.AC_DEFENDER_VERSION || pkg.version;
const revision=process.env.AC_DEFENDER_REVISION || execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const builtAt=process.env.AC_DEFENDER_BUILD_TIME || new Date().toISOString();
if(!/^\d+\.\d+\.\d+$/.test(version)||version!==pkg.version)throw Error('Build version must match the package version');
if(!/^[a-f0-9]{40}$/.test(revision))throw Error('Build revision must be a complete Git SHA');
if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(builtAt)||Number.isNaN(Date.parse(builtAt)))throw Error('Build time must be a valid recorded UTC ISO timestamp');
const metadata={version,source:revision,builtAt,articleCount:articles.length};
await writeFile('app/catalog.json',JSON.stringify({metadata,articles}));
for(const name of ['index.html','style.css'])await cp('src/'+name,'app/'+name);
console.log(`Bundled ${articles.length} rendered articles and complete site assets.`);

await build({entryPoints:['src/reader.ts','src/search-worker.ts'],outdir:'app',bundle:true,format:'esm',target:'chrome130'});
