document.addEventListener("contextmenu", ddgHandler, false);

function ddgHandler(ddgEvent) {
    var sel = '';
    sel = window.parent.getSelection()+'';
    sel = sel.replace(/^\s+|\s+$/g,"");
    safari.self.tab.setContextMenuEventUserInfo(ddgEvent, sel);
}
