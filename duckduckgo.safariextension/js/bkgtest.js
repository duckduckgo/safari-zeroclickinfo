let onBeforeRequestAdapter = (e) => {
    console.log(e)
}

safari.application.addEventListener("message", onBeforeRequestAdapter, true);
