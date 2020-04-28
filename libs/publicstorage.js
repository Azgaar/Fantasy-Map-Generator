// https://github.com/Highbrainer/jeevaneo-js-publicstorage. MIT
const IFRAME_ROOT_URL = "https://publicstorage.neocities.org/shared-iframe.html";

class PublicStorageAccess {

	 constructor ({debug=false}={}) {
		 this.uid = this.uniqueId();
		 this.debug=debug;
	 }
	 
	uniqueId() {
		function chr4(){
			return Math.random().toString(16).slice(-4);
			}
		return chr4() + chr4() +
				'-' + chr4() +
				'-' + chr4() +
				'-' + chr4() +
				'-' + chr4() + chr4() + chr4();
	}

	_debug(msg) {
		if(this.debug) {
			if(console && console.debug) {
				console.debug(msg);
			}
		}
	}
	
	 prepareIFrame() {
		const that = this;
		const iframe = document.createElement("iframe");
		iframe.id=that.uid;
		iframe.src=IFRAME_ROOT_URL + "?uid=init-"+that.uid;
		iframe.style.cssText="display:none;";
		return new Promise(function(resolve, reject) {
			window.addEventListener('message', function mafunc(tkn) {
				
				if (IFRAME_ROOT_URL.indexOf(tkn.origin)<0) {
					return;
				}
				
				try {
					const packet = JSON.parse(tkn.data);
					
					if(!(packet.frameId === "init-" + that.uid)) {
						// ignore
						return;
					}
					
					if(packet.ready) {
						resolve(iframe);					
					}
				} catch (e) {
					reject(tkn.data);
				}
				window.removeEventListener('message', mafunc);
		    });
			onLoadThen().then(() => {
				document.getElementsByTagName("body")[0].appendChild(iframe);
			});

			setTimeout(()=>reject(`Request ${that.uid} TIMEOUTED!`), 20000);
		});
	}
	 
	 access(access, prop, value = null, level = "local") {
			
			if(!(access === "get" || access === "set" || access === "delete")) {
				throw new Error("access can only be 'set', 'get' or 'delete' - not '" + access + "'");
			}
			
			if (!prop) {
				throw new Error("Prop name is mandatory");
			}
			
			if(!(level === "local" || level === "session")) {
				throw new Error("level can only be 'session' or 'local' - not '" + access + "'");
			}
				
			const that = this;
			
			const promise = new Promise(function(resolve, reject) {
				that.prepareIFrame().then(iframe => {
					window.addEventListener('message', function mafunc(tkn) {
						if (IFRAME_ROOT_URL.indexOf(tkn.origin)<0) {
							return;
						}
						try {
							var packet = JSON.parse(tkn.data);
							
							if(!(packet.uid === that.uid)) {
								// ignore
								return;
							}
							resolve(packet.body);
						} catch (e) {
							reject(tkn.data);
						}
						iframe.parentNode.removeChild(iframe);
						window.removeEventListener('message', mafunc);
				    });
			
					const request = {uid:that.uid, access:access, prop:prop, value:value, level:level};
					iframe.contentWindow.postMessage(JSON.stringify(request), '*');
					setTimeout(()=>reject("TIMEOUTED!"), 20000);
				});
			});
			return promise;
		}
	
}

function __createDebugIFrame() {
	onLoadThen().then(function(){
		const iframe = document.createElement("iframe");
		iframe.src=IFRAME_ROOT_URL + "?for-debug-only";
		iframe.style.cssText="display:none;";
		document.getElementsByTagName("body")[0].appendChild(iframe);
	});
}

class PublicStorage { 
	
	constructor({debug=false}={}) {
		if(debug) {
				__createDebugIFrame();
		}
	}
	 
	sessionGet(prop) {
		 return new PublicStorageAccess().access("get", prop, null, "session");
	}
	sessionSet(prop, value) {
		 return new PublicStorageAccess().access("set", prop, value, "session");
	}
	sessionUnset(prop) {
		 return new PublicStorageAccess().access("delete", prop, null, "session");
	}
	localGet(prop) {
		 return new PublicStorageAccess().access("get", prop, null, "local");
	}
	localSet(prop, value) {
		 return new PublicStorageAccess().access("set", prop, value, "local");
	}
	localUnset(prop) {
		 return new PublicStorageAccess().access("delete", prop, null, "local");
	}
	get(prop) {
		 return this.localGet(prop);
	}
	set(prop, value) {
		 return this.localSet(prop, value);
	}
	unset(prop) {
		return this.localUnset(prop);
	}
}

const publicstorage = new PublicStorage();

function onLoadThen() {
	return new Promise(function(resolve, reject) {
		if (window) {
			if(document.getElementsByTagName('BODY')[0]) {
				resolve();
			} else {
				registerOnLoad(function unregisterme() {
					resolve();
					window.removeEventListener('load', unregisterme);
				});
			}
		}
		setTimeout(function() {reject(new Error("Timeout waiting for onLoad!"));}, 10000);
	});
}

function registerOnLoad(lambda) {
	if (window.addEventListener) {
		  window.addEventListener('load', lambda);
	} else if (window.attachEvent) {
		  window.attachEvent('onload', lambda);
	}
}

onLoadThen().then(() => window.publicstorage = publicstorage).catch(e=> console.error(e));
//export {onLoadThen, PublicStorage, publicstorage as default}
// module.exports = onLoadThen();
