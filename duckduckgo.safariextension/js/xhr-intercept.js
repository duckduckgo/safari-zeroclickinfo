let mainFrameURL

var onBeforeLoad = (e) => {
    let block = {}
    let frame = (window === window.top) ? "main_frame" : "sub_frame"

    if (frame == 'main_frame' && !mainFrameURL) {
        mainFrameURL = e.target.baseURI
    }

    if (e.url) {
        block = safari.self.tab.canLoad(e, {currentURL: e.target.baseURI, potentialTracker: e.url, frame: frame, mainFrameURL: mainFrameURL})
    }

    if (block.cancel) e.preventDefault()
}

var unload = (e) => {
    if (window === window.top) {
        safari.self.tab.dispatchMessage('unloadTab', {unload: e.target.URL})
    }
}

window.onbeforeunload = ((e) => unload(e))
document.addEventListener('beforeload', onBeforeLoad, true);
