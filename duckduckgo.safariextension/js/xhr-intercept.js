let mainFrameURL
let id = Math.floor(Math.random()*(100000-1000+1)+1000);

var onBeforeLoad = (e) => {
    let block = {}
    let frame = (window === window.top) ? "main_frame" : "sub_frame"

    if (frame == 'main_frame' && !mainFrameURL) {
        mainFrameURL = getLocation()
    }

    if (e.url) {
        block = safari.self.tab.canLoad(e, {currentURL: e.target.baseURI, potentialTracker: e.url, frame: frame, mainFrameURL: mainFrameURL, tabId: id})
    }

    if (block.cancel) e.preventDefault()
}

var unload = (e) => {
    if (window === window.top) {
        safari.self.tab.dispatchMessage('unloadTab', {unload: mainFrameURL, tabId: id})
    }
}

// return location without params
function getLocation () {
    return location.protocol + "//" + location.hostname + location.pathname
}

window.onbeforeunload = ((e) => unload(e))
window.onfocus = ((e) => sendLoadEvent(e))

document.addEventListener('beforeload', onBeforeLoad, true);
document.addEventListener("DOMContentLoaded", sendLoadEvent, true)
        
        
function sendLoadEvent (event) {
    if (window === window.top) {
        var meta = document.createElement('meta');
        meta.name = "tab-id";
        meta.content = id
        document.getElementsByTagName('head')[0].appendChild(meta);
        safari.self.tab.dispatchMessage('tabLoaded', {mainFrameURL: mainFrameURL, tabId: id})
    }
}
