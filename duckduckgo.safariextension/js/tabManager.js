class TabManager {
    constructor() {
        this.tabContainer = {}
    };

    /* This overwrites the current tab data for a given
     * id and is only called in three cases:
     * 1. When we rebuild saved tabs when the browser is restarted
     * 2. When a new tab is opened. See onUpdated listener below
     * 3. When we get a new main_frame request
     */
    create(tabData) {
        console.log(`CREATE TAB: ${tabData.url}`)
        let newTab = new Tab(tabData);
        this.tabContainer[newTab.id] = newTab;
        return newTab;
    };

    delete(id) {
        console.log(`DELETE TAB ${id}`)
        delete this.tabContainer[id];
    };

    /* Called using either a chrome tab object or by id
     * get({tabId: ###});
     */
    get(tabData) {
        return this.tabContainer[tabData.tabId];
    };

    /* This will whitelist any open tabs with the same domain
     * list: name of the whitelist to update
     * domain: domain to whitelist
     * value: whitelist value, true or false
     */
    whitelistDomain(data) {
        this.setGlobalWhitelist(data.list, data.domain, data.value)
        
        for (let tabId in this.tabContainer) {
            let tab = this.tabContainer[tabId];
            if (tab.site && tab.site.domain === data.domain) {
                tab.site.setWhitelisted(data.list, data.value)
            }
        }

    }

    /* Update the whitelists kept in settings
     */
    setGlobalWhitelist(list, domain, value) {
        let globalwhitelist = settings.getSetting(list) || {}

        if (value) {
            globalwhitelist[domain] = true
        }
        else {
            delete globalwhitelist[domain]
        }

        settings.updateSetting(list, globalwhitelist)
    }
}

var tabManager = new TabManager();

/*
chrome.tabs.onRemoved.addListener( (id, info) => {
    // remove the tab object
    tabManager.delete(id);
});
*/

var closeHandler = function (e) {
    let url
    if (e.type === 'close') {
        url = e.target.url
    } else {
        url = e.message.unload
    }

    let tabs = getDuplicateTabCount(e.target.browserWindow.tabs, url)
    // the safari tab may or may not exist when we get the event so 0 or 1 tabs
    if (tabs <= 1) tabManager.delete(url)

    updateTabBadge(e, 0)
}

safari.application.addEventListener("close", closeHandler, true);

/* This handles the new tab case. You have clicked to 
 * open a new tab and haven't typed in a url yet.
 * This will fire an onUpdated event and we can create
 * an intital tab instance here. We'll update this instance
 * later on when webrequests start coming in.
 */
/*
safari.application.addEventListener('open', ( (tabEvent) => {
    if (!tabManager.get({'tabId': tabEvent.url})) {
        // adapt safari tabevent data to work with tabManager.create
        // safari doesn't have unique IDs for each tab so we'll use the url for now
        let createData = {id: tabEvent.url, url: tabEvent.url, requestId: 0, status: 'complete'}

        tabManager.create(info);
    }
    else {
        let tab = tabManager.get({tabId: id});
        if (tab && info.status) {
            tab.status = info.status;

            if (tab.status === 'complete') {

                if (tab.url.match(/^https:\/\//)) {
                    tab.site.score.update({hasHTTPS: true})
                }
                tab.checkHttpsRequestsOnComplete()
                console.info(tab.site.score);
                tab.updateBadgeIcon();
            } 
        }
    }

}), true);
*/
/*
chrome.runtime.onMessage.addListener( (req, sender, res) => {
    if (req.whitelisted) {
        tabManager.whitelistDomain(req.whitelisted)
        chrome.runtime.sendMessage({whitelistChanged: true});
    }
    else if (req.getTab) {
        res(tabManager.get({'tabId': req.getTab}))
    }
    else if (req.getSiteScore) {
        let tab = tabManager.get({tabId: req.getSiteScore})
        res(tab.site.score.get())
    }
    return true;
});
*/

function getDuplicateTabCount (tabs, url) {
    let count = 0
    tabs.forEach((tab) => {
        if(tab.url === url) {
            count += 1
        }
    })
    return count
}

// update tab url after the request is finished. This makes
// sure we have the correct url after any https rewrites
safari.application.addEventListener('message', ( (request) => {

    if (request.name === 'unloadTab') {
        closeHandler(request)
    }

    if (request.name === 'tabLoaded') {
        updateTabBadge(request)
    }

    /*
    let tab = tabManager.get({tabId: request.tabId});
    if (tab) {
        tab.url = request.url;
        tab.updateSite();
        Companies.incrementPages();
    }
    */
}), true);

// temp hack to show site score as badge icon number
var updateTabBadge = function(e, val) {
    console.log(`UPDATE BADGE: ${e.name}`)

    if (val === 0) {
        safari.extension.toolbarItems[0].badge = val
    }
    else {
        let map = {A: 0, B: 1, C: 2, D: 3}
        let url = (e.target && e.target.url) ? e.target.url : (e.target.activeTab) ? e.target.activeTab.url : ''

        if (e.name === 'tabLoaded') url = e.message.mainFrameURL

        let tab = tabManager.get({tabId: url})

        console.log("UPDATE BADGE FOR TAB")
        console.log(tab)

        if (!tab) {
            safari.extension.toolbarItems[0].badge = 0
                return
        }
        safari.extension.toolbarItems[0].badge = map[tab.site.score.get()]
    
    }
}

safari.application.addEventListener('activate', updateTabBadge, true)
