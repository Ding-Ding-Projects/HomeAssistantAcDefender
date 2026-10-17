const {app,BrowserWindow,ipcMain,dialog,shell,session}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {Engine}=require('./engine.cjs');
let window,engine;
if(!app.requestSingleInstanceLock())app.quit();
app.whenReady().then(async()=>{
  const root=path.join(__dirname,'..');const target=pathToFileURL(path.join(root,'renderer/index.html')).href;
  engine=new Engine({statePath:path.join(app.getPath('userData'),'setup-state.json'),composePath:path.join(root,'resources/compose.yml'),metadata:require('../resources/build.json')});await engine.restore();
  session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  window=new BrowserWindow({width:1120,height:820,minWidth:720,minHeight:640,backgroundColor:'#f5f8f7',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());
  const handlers={snapshot:()=>engine.snapshot(),checks:()=>engine.checks(),destination:async()=>{const choice=await dialog.showOpenDialog(window,{properties:['openDirectory'],title:'Choose parent folder for a new AC Defender deployment'});return choice.canceled?engine.snapshot():engine.destination(choice.filePaths[0]);},configure:value=>engine.configure(value),invalidate:()=>engine.invalidate(),start:()=>engine.start(),cancel:()=>engine.cancel(),open:async value=>{if(typeof value!=='string'||!engine.state.urls.includes(value)||engine.state.phase!=='complete')throw new Error('invalidUrl');await shell.openExternal(value);return engine.snapshot();}};
  for(const [name,handler]of Object.entries(handlers))ipcMain.handle(`setup:${name}`,async(event,value)=>{if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||event.senderFrame.url!==target)return {error:'invalidSender'};try{return await handler(value);}catch(e){return {...engine.snapshot(),error:e.code||'operationFailed'};}});
  window.on('close',event=>{if(engine.operation){event.preventDefault();engine.cancel();}});await window.loadURL(target);
});
app.on('window-all-closed',()=>app.quit());
