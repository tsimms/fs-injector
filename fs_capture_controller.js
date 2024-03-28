(function _fs_capture_controller() {

  // execute fsjsj code for specified org
  const inject_fs = (orgId, isNewSession) => {

  window['_fs_debug'] = false;
  window['_fs_host'] = 'fullstory.com';
  window['_fs_script'] = 'edge.fullstory.com/s/fs.js';
  window['_fs_org'] = orgId;
  window['_fs_namespace'] = 'FS';
  (function(m,n,e,t,l,o,g,y){
    if (e in m) {if(m.console && m.console.log) { m.console.log('FullStory namespace conflict. Please set window["_fs_namespace"].');} return;}
    g=m[e]=function(a,b,s){g.q?g.q.push([a,b,s]):g._api(a,b,s);};g.q=[];
    o=n.createElement(t);o.async=1;o.crossOrigin='anonymous';o.src='https://'+_fs_script;
    y=n.getElementsByTagName(t)[0];y.parentNode.insertBefore(o,y);
    g.identify=function(i,v,s){g(l,{uid:i},s);if(v)g(l,v,s)};g.setUserVars=function(v,s){g(l,v,s)};g.event=function(i,v,s){g('event',{n:i,p:v},s)};
    g.anonymize=function(){g.identify(!!0)};
    g.shutdown=function(){g("rec",!1)};g.restart=function(){g("rec",!0)};
    g.log = function(a,b){g("log",[a,b])};
    g.consent=function(a){g("consent",!arguments.length||a)};
    g.identifyAccount=function(i,v){o='account';v=v||{};v.acctId=i;g(o,v)};
    g.clearUserCookie=function(){};
    g.setVars=function(n, p){g('setVars',[n,p]);};
    g._w={};y='XMLHttpRequest';g._w[y]=m[y];y='fetch';g._w[y]=m[y];
    if(m[y])m[y]=function(){return g._w[y].apply(this,arguments)};
    g._v="1.3.0";
  })(window,document,window['_fs_namespace'],'script','user');
  if (isNewSession) {
    FS.identify(getAnonymousUid());
  }

  }

  // routine for sending data to extension
  const sendMessage = (types) => {
    const message = types.map(type => {
      if (type === 'fs_isLoaded') return { type, data: [isFSLoaded(), getOrgId()] }
      if (type === 'fs_isRunning') return { type, data: isFSRunning() } 
      if (type === 'fs_link') return { type, data: getLink() }
      if (type === 'fs_link_cache') return { type, data: getLink() }
      if (type === 'fs_detected') return { type }
      if (type === 'fs_undetected') return { type }
    });
    window.postMessage(message);
  };

  // listening for events from extension
  window.addEventListener("message", (event) => {

    switch (event.data.type) {
      case '_fs_capture_controller_inject':
        if (isFSRunning()) return;
        const [orgId, isNewSession] = event.data.args;
        inject_fs(orgId, isNewSession);
        setTimeout(() => { sendMessage(['fs_isLoaded','fs_isRunning']) }, 1000);
        break; 
      case '_fs_capture_controller_pause':
        const [ forceStop ] = event.data.args;
        sendMessage(['fs_link_cache']);
        getNamespace().shutdown();
        sendMessage(['fs_isRunning']);
        if (forceStop) window.location.reload();
        break;
      case '_fs_capture_controller_resume':
        getNamespace().restart();
        setTimeout(() => { sendMessage(['fs_isRunning']) }, 1000);
        break;
      case '_fs_capture_controller_link':
        sendMessage(['fs_link']);
        break;
      case '_fs_capture_controller_getStatus':
        sendMessage(['fs_isLoaded','fs_isRunning']);
        break;
    }
  }, false);

  const isFSRunning = () => (
    isFSLoaded() && getNamespace().getCurrentSession && getNamespace().getCurrentSession() != null
  );

  const isFSLoaded = () => (
    window['_fs_namespace'] && typeof(window[window['_fs_namespace']]) === 'function'
  );

  const getLink = () => (
    isFSRunning() && getNamespace().getCurrentSessionURL()
  );

  const getNamespace = () => (
    window[window['_fs_namespace']]
  );

  const getOrgId = () => (
    isFSRunning() ? window['_fs_org'] : ""
  );

  const getAnonymousUid = () => {
    crypto.randomUUID();
  };

  // at time of extension injection, determine if FS is running
  const interval = setInterval(() => {
    if (isFSLoaded()) {
      // FullStory detected!
      clearTimeout(timeout);
      clearInterval(interval);
      sendMessage(['fs_detected']);
    }
  }, 100);
  const timeout = setTimeout(() => {
    clearInterval(interval);
    sendMessage(['fs_undetected']);
  }, 1000);

})()

