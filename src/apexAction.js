const APEX_ACTION_MATCHER = /https:\/\/.+lightning\.force\.com\/aura\?r=\d+&aura.ApexAction.execute=(\d+)/g;

let apexActionRequestCache = {}
let apexActionResponseCache = {}

chrome.devtools.network.onRequestFinished.addListener(captureApexActionRequest);

document.querySelector('#filter-input').addEventListener('input', handleFilterInput);
document.querySelector('#clear-button').addEventListener('click', clearCache);
document.querySelector('#apex-action-table').addEventListener('click', handleViewResponse);

function addToCache(key, cache, cacheValue) {
    let existingCache = cache[key]
    if (!existingCache) {
        existingCache = []
    }
    existingCache.push(cacheValue)
    cache[key] = existingCache  
}

function captureApexActionRequest(request) {
        const url = request.request.url;
        const matchRes = [...url.matchAll(APEX_ACTION_MATCHER)]
        if (matchRes.length > 0) {
            const allParams = request.request.postData.params;
            const messageParam = JSON.parse(JSON.stringify(allParams.find(item => item.name === 'message')))
            if (messageParam) {
                const message = JSON.parse(decodeURIComponent(messageParam.value));
                const actions = message.actions;
                const allRequestIds = []
                for (const action of actions) {
                    // some action has no class name, skip this kind of action
                    if (action.params.classname) {
                        const requestId = action.id;
                        allRequestIds.push(requestId);
                        const cacheValue = {
                            requestId,
                            method: action.params.method,
                            classname: action.params.classname,
                            params: action.params.params,
                        }
                        addToCache(action.params.classname, apexActionRequestCache, cacheValue)
                        addToCache(action.params.method, apexActionRequestCache, cacheValue)
                    }
                }

                request.getContent((bodyTxt) => {
                    const body = JSON.parse(bodyTxt);
                    const respActionMap = body.actions.reduce((acc, i) => {
                        acc[i.id] = i; 
                        return acc;
                    }, {});
                    for (const requestId of allRequestIds) {
                        const respAction = respActionMap[requestId];
                        if (!respAction) {
                            logToInspectWindow(`No response for requestId: ${requestId}`);
                            continue;
                        }
                        apexActionResponseCache[requestId] = respAction
                    }
                })
                
                
            } else {
                logToInspectWindow(`No message param found in request`);
            }
        }

}

function logToInspectWindow(rawMessage) {
    let message;
    if (typeof rawMessage !== 'string') {
        message = JSON.stringify(rawMessage);
    }
    chrome.devtools.inspectedWindow.eval(
        `console.log('${message}')`);
}

function handleFilterInput(ev) {
    const input = ev.target.value;
    if (input.length === 0) {
        clearFilteredResult();
        return;

    }
    if (input.length < 3) {
        return;
    }
    const apexActionTableBody = document.querySelector('#apex-action-body');
    apexActionTableBody.innerHTML = '';
    const allMatchedResults = Object.entries(apexActionRequestCache)
        .filter(([key, _]) => key.startsWith(input))
        .reduce((acc, [_, requests]) => {
            const allRes = requests.map(request => buildColumnWithRequestResponse(request, apexActionResponseCache[request.requestId]))
            acc.push(...allRes);  
            return acc;
        }, [])
    apexActionTableBody.append(...allMatchedResults);
}

function handleViewResponse(ev) {
    if (!ev.target.dataset.id) {
        return;
    }
    const requestId = ev.target.dataset.id;
    
    const response = apexActionResponseCache[requestId];
    document.querySelector('#response-json-viewer').innerHTML = JSON.stringify(response, null, 2);
}

function buildColumnWithRequestResponse(request, response) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${request.classname}</td><td>${request.method}</td><td>${JSON.stringify(request.params)}</td><td>${response.state}</td><td><a data-id="${request.requestId}">View Response</a></td>`;
    return tr;
}

function clearFilteredResult() {
    const apexActionTableBody = document.querySelector('#apex-action-body');
    apexActionTableBody.innerHTML = '';
    document.querySelector('#response-json-viewer').innerHTML = '';
}

function clearCache() {
    apexActionRequestCache = {};
    apexActionResponseCache = {};
    const apexActionTableBody = document.querySelector('#apex-action-body');
    apexActionTableBody.innerHTML = '';
    document.querySelector('#response-json-viewer').innerHTML = '';
}
