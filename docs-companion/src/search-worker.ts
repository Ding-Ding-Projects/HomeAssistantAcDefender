self.onmessage = (event: MessageEvent<{query:string;regex:boolean;articles:{title:string;text:string;path:string}[]}>) => {
 try {const {query,regex,articles}=event.data;const expression=regex?new RegExp(query,'iu'):null;self.postMessage({paths:articles.filter(a=>expression?expression.test(a.title+' '+a.text):(a.title+' '+a.text).toLowerCase().includes(query.toLowerCase())).map(a=>a.path)});}
 catch {self.postMessage({error:'Invalid regular expression'});}
};
