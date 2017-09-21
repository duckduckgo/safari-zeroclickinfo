var onBeforeLoad = (e) => {
    safari.self.tab.canLoad(e, e.url)
}

document.addEventListener('beforeload', onBeforeLoad, true);
