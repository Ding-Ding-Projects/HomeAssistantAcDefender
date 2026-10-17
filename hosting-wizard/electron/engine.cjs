const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
function privateIPv4(host){if(net.isIP(host)!==4)return false;const [a,b]=host.split('.').map(Number);return a===10||a===192&&b===168||a===172&&b>=16&&b<=31||a===169&&b===254;}
function localEndpoint(host){if(typeof host!=='string')throw new SetupError('localEngineRequired');if(/^unix:\/\/\/[A-Za-z0-9_./-]+$/.test(host)&&!host.split('/').includes('..'))return host;if(/^npipe:\/{4}(?:\.|localhost)\/pipe\/[A-Za-z0-9_.-]+$/i.test(host))return host;throw new SetupError('localEngineRequired');}
const {spawn} = require('node:child_process');

class SetupError extends Error { constructor(code) { super(code); this.code = code; } }
function validate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).sort().join(',') !== 'endpoint,entity,httpConsent,token') throw new SetupError('invalidConfiguration');
  if (typeof raw.endpoint !== 'string' || raw.endpoint.length > 2048 || typeof raw.entity !== 'string' || !/^climate\.[a-z0-9_]{1,150}$/.test(raw.entity) || typeof raw.token !== 'string' || !/^[A-Za-z0-9._~-]{20,4096}$/.test(raw.token) || typeof raw.httpConsent !== 'boolean') throw new SetupError('invalidConfiguration');
  let url; try { url = new URL(raw.endpoint); } catch { throw new SetupError('invalidEndpoint'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new SetupError('invalidEndpoint');
  const privateHost = privateIPv4(url.hostname) || url.hostname.endsWith('.local');
  if (url.protocol === 'http:' && (!raw.httpConsent || !privateHost)) throw new SetupError('privateHttpConsent');
  return {...raw, endpoint:url.origin};
}
function runProcess(exe, args, {signal, cwd, timeout=30000}={}) {
  return new Promise((resolve,reject) => {
    if (signal?.aborted) return reject(new SetupError('cancelled'));
    if(process.platform==='win32'){if(exe==='docker')exe=path.join(process.env.ProgramFiles||'C:\\Program Files','Docker','Docker','resources','bin','docker.exe');else if(['whoami.exe','icacls.exe'].includes(exe))exe=path.join(process.env.SystemRoot||'C:\\Windows','System32',exe);}
    const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>! /^(AC_DEFENDER_|COMPOSE_|HomeAssistant__|FORWARDED_HEADERS_)/i.test(key)));
    if(args.includes('--host')){delete env.DOCKER_HOST;delete env.DOCKER_CONTEXT;}
    const child = spawn(exe,args,{cwd,env,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let output='', bytes=0, settled=false, stopError=null, killTimer=null;
    const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(killTimer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(output);};
    const stop=(code)=>{if(stopError)return;stopError=new SetupError(code);child.kill();killTimer=setTimeout(()=>child.kill('SIGKILL'),2000);};
    const abort=()=>stop('cancelled');
    const timer=setTimeout(()=>{stop('operationTimeout');},timeout);
    signal?.addEventListener('abort',abort,{once:true});
    child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>65536){stop('outputLimit');}else output+=chunk.toString();});
    child.stderr.on('data',()=>{});
    child.once('error',()=>finish(new SetupError('processUnavailable')));
    child.once('close',code=>finish(stopError||(code===0?null:new SetupError('processFailed'))));
  });
}
async function protectDirectory(directory,run=runProcess,platform=process.platform) {
  if(platform==='win32') {
    const identity=await run('whoami.exe',['/user','/fo','csv','/nh']);
    const sid=identity.match(/S-1-5-(?:\d+-)*\d+/)?.[0];
    if(!sid) throw new SetupError('protectionFailed');
    await run('icacls.exe',[directory,'/inheritance:r','/grant:r',`*${sid}:(OI)(CI)F`]);
  } else await fs.chmod(directory,0o700);
}
class Engine {
  constructor({statePath,composePath,metadata,run=runProcess,fetcher=fetch,platform=process.platform,interfaces=os.networkInterfaces}) {
    Object.assign(this,{statePath,composePath,metadata,run,fetcher,platform,interfaces});
    this.state={phase:'prerequisites',ready:false,config:null,directory:null,urls:[],error:null};this.secret=null;this.operation=null;
  }
  snapshot(){return {...this.state,config:this.state.config?{...this.state.config}:null,busy:!!this.operation,credentialsReady:!!this.secret,metadata:this.metadata};}
  async persist(){await fs.mkdir(path.dirname(this.statePath),{recursive:true});await fs.writeFile(this.statePath,JSON.stringify(this.state),{mode:0o600});}
  async restore(){try{const s=JSON.parse(await fs.readFile(this.statePath,'utf8'));if(s.directory&&path.isAbsolute(s.directory)&&/^ac-defender-[a-f0-9]{16}$/.test(path.basename(s.directory))){const checked=s.config?validate({...s.config,token:'resume-validation-placeholder'}):null;if(checked)delete checked.token;this.state={phase:s.created?'interrupted':'configuration',ready:false,urls:[],directory:s.directory,config:checked,created:s.created===true,preparationFailed:s.preparationFailed===true,error:null};}}catch{}return this.snapshot();}
  async checks(){if(this.operation)throw new SetupError('busy');this.state.ready=false;
    try{const selected=this.run===runProcess&&process.env.DOCKER_HOST?process.env.DOCKER_HOST:(await this.run('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'])).trim();this.engineEndpoint=localEndpoint(selected);const pinned=['--host',this.engineEndpoint];await this.run('docker',[...pinned,'version','--format','{{.Server.Version}}']);await this.run('docker',[...pinned,'compose','version','--short']);const kind=(await this.run('docker',[...pinned,'info','--format','{{.OSType}}'])).trim();if(kind!=='linux')throw new SetupError('linuxContainersRequired');this.state.ready=true;this.state.error=null;}catch(e){this.engineEndpoint=null;this.state.error=e.code||'prerequisiteFailed';}return this.snapshot();}
  async destination(parent){if(this.operation||this.state.created)throw new SetupError('busy');if(!path.isAbsolute(parent))throw new SetupError('invalidDestination');this.state.preparationFailed=false;this.state.error=null;this.state.directory=path.join(parent,`ac-defender-${crypto.randomBytes(8).toString('hex')}`);await this.persist();return this.snapshot();}
  async configure(raw){if(this.operation||this.state.created)throw new SetupError('busy');const c=validate(raw);this.secret=c.token;delete c.token;this.state.config=c;this.state.phase='review';this.state.error=null;await this.persist();return this.snapshot();}
  invalidate(){if(this.operation||this.state.created)throw new SetupError('busy');this.secret=null;this.state.phase='configuration';return this.snapshot();}
  cancel(){this.operation?.abort();return this.snapshot();}
  async assertOwned(){for(const target of [this.state.directory,...['setup-owner.json','.env','compose.yml'].map(f=>path.join(this.state.directory,f))]){if((await fs.lstat(target)).isSymbolicLink())throw new SetupError('ownershipMismatch');}const marker=JSON.parse(await fs.readFile(path.join(this.state.directory,'setup-owner.json'),'utf8'));if(marker.id!==path.basename(this.state.directory)||marker.revision!==this.metadata.revision||crypto.createHash('sha256').update(await fs.readFile(path.join(this.state.directory,'compose.yml'))).digest('hex')!==crypto.createHash('sha256').update(await fs.readFile(this.composePath)).digest('hex'))throw new SetupError('ownershipMismatch');}
  composeArgs(action){return ['--host',localEndpoint(this.engineEndpoint),'compose','--project-name',path.basename(this.state.directory),'--env-file',path.join(this.state.directory,'.env'),'-f',path.join(this.state.directory,'compose.yml'),...action];}
  async health(url,signal){try{const response=await this.fetcher(`${url}/healthz`,{signal:AbortSignal.any([signal,AbortSignal.timeout(4000)]),redirect:'error'});if(!response.ok)return false;let body='';if(response.body?.getReader){const reader=response.body.getReader();let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return false;}body+=new TextDecoder().decode(value,{stream:true});}}else{body=await response.text();if(body.length>4096)return false;}const data=JSON.parse(body);return data.status==='ok'&&data.revision===this.metadata.revision&&data.version===this.metadata.version;}catch{return false;}}
  async start(){if(this.operation)throw new SetupError('busy');if(this.state.preparationFailed)throw new SetupError('newDestinationRequired');if(!this.state.ready||!this.engineEndpoint||!this.state.directory||!this.state.config)throw new SetupError('notReady');if(!/^[a-f0-9]{40}$/.test(this.metadata.revision)||!/^\d+\.\d+\.\d+$/.test(this.metadata.version))throw new SetupError('provenanceRequired');if(!this.state.created&&!this.secret)throw new SetupError('credentialsRequired');
    const controller=new AbortController();this.operation=controller;const signal=controller.signal;this.state.error=null;this.state.urls=[];
    try{
      const lanHosts=[...new Set(Object.values(this.interfaces()).flat().filter(n=>n.family==='IPv4'&&!n.internal&&privateIPv4(n.address)).map(n=>n.address))].slice(0,8);
      if(!this.state.created){this.state.preparationFailed=true;await this.persist();await fs.mkdir(this.state.directory,{mode:0o700});await protectDirectory(this.state.directory,this.run,this.platform);if(signal.aborted)throw new SetupError('cancelled');
        const c=this.state.config;const env=[`AC_DEFENDER_IMAGE=ghcr.io/ding-ding-projects/homeassistantacdefender:sha-${this.metadata.revision}`,`AC_DEFENDER_VERSION=${this.metadata.version}`,`AC_DEFENDER_REVISION=${this.metadata.revision}`,`AC_DEFENDER_CONTAINER_NAME=${path.basename(this.state.directory)}`,`HomeAssistant__BaseUrl=${c.endpoint}`,`HomeAssistant__EntityId=${c.entity}`,`HomeAssistant__AllowInsecurePrivateNetworkHttp=${c.httpConsent}`,`HomeAssistant__AccessToken=${this.secret}`,'FORWARDED_HEADERS_KNOWN_PROXIES=127.0.0.1',`FORWARDED_HEADERS_ALLOWED_HOSTS=${['localhost','127.0.0.1',...lanHosts].join(',')}`, ''];
        await fs.writeFile(path.join(this.state.directory,'.env'),env.join('\n'),{flag:'wx',mode:0o600});this.secret=null;await fs.copyFile(this.composePath,path.join(this.state.directory,'compose.yml'),require('node:fs').constants.COPYFILE_EXCL);await fs.writeFile(path.join(this.state.directory,'setup-owner.json'),JSON.stringify({id:path.basename(this.state.directory),revision:this.metadata.revision}),{flag:'wx',mode:0o600});this.state.created=true;this.state.preparationFailed=false;await this.persist();
      }else await this.assertOwned();
      for(const [phase,args] of [['pulling',['pull','--quiet']],['starting',['up','-d','--no-build']],['checking',['ps','--status','running','--quiet']]]){if(signal.aborted)throw new SetupError('cancelled');this.state.phase=phase;await this.persist();const result=await this.run('docker',this.composeArgs(args),{cwd:this.state.directory,signal,timeout:phase==='pulling'?600000:120000});if(phase==='checking'&&!result.trim())throw new SetupError('serviceNotRunning');}
      this.state.phase='health';await this.persist();let healthy=false;
      for(let i=0;i<30&&!signal.aborted;i++){if(await this.health('http://127.0.0.1:8888',signal)){healthy=true;break;}await new Promise(resolve=>{const timer=setTimeout(resolve,2000);signal.addEventListener('abort',()=>{clearTimeout(timer);resolve();},{once:true});});}
      if(signal.aborted)throw new SetupError('cancelled');if(!healthy)throw new SetupError('healthFailed');this.state.urls=['http://127.0.0.1:8888'];
      for(const address of lanHosts){if(signal.aborted)throw new SetupError('cancelled');const url=`http://${address}:8888`;if(await this.health(url,signal))this.state.urls.push(url);}
      this.state.phase='complete';
    }catch(e){this.state.phase=signal.aborted?'cancelled':'failed';this.state.error=e instanceof SetupError?e.code:'operationFailed';}finally{this.secret=null;this.operation=null;await this.persist();}return this.snapshot();
  }
}
module.exports={Engine,SetupError,validate,runProcess,protectDirectory,localEndpoint,privateIPv4};
