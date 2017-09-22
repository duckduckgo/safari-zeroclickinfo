var onBeforeLoad = (e) => {
    let block = safari.self.tab.canLoad(e, e.url)
    if (block.cancel) e.preventDefault()
}

document.addEventListener('beforeload', onBeforeLoad, true);
