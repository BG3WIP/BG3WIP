const { log, line, print, debug, logged, timed, unlogged, untimed, usage, obj, cache } = require('../lib/common');

module.exports = (dbCache, txtResources) => function find(resource, string, isCaseSensitive = false, firstOnly = false) {
    isCaseSensitive = (isCaseSensitive === '0') ? false : isCaseSensitive;
    firstOnly = (firstOnly === '0')  ? false : firstOnly;
    let resources;
    debug('dbCache-start', dbCache.find)
    if (resource == 'last') {
        debug('last', dbCache.find.last)
        resources = timed(txtResources)(dbCache.find.last.resource)
        dbCache.find.last.history.map(
            ([string, isCaseSensitive, firstOnly]) => resources = _find(resources, string, isCaseSensitive, firstOnly)
        )
    } else {
        resources = timed(txtResources)(resource)
    }
    line('find', string, isCaseSensitive, firstOnly)
    function _find (resources, string, isCaseSensitive, firstOnly) {
        line('_find', string)
        let f;
        if (!string) {
            f = e => i => true
            debug('all')
        } else if (string.split(':').length >= 2) {
            const [p, v] = string.split(':')
            debug('prop search', p, v)
            const _f = firstOnly ?
                            e => i => v => debug(e) || e[p] && (e[p].indexOf(v) == 0 || !isCaseSensitive && e[p].toLowerCase().indexOf(v.toLowerCase()) === 0)
                            :
                            e => i => v => e[p] && (e[p].includes(v) || !isCaseSensitive && e[p].toLowerCase().includes(v.toLowerCase()));
            
            const values = v.split('|')
            f = e => i => values.map(_f(e)(i)).reduce((a, b) => a || b)
        } else {
            debug('standart search', string)
            if (isCaseSensitive) {
                f = e => i => e[i].indexOf(string) !== -1 || string === i && !!e[i]
            } else {
                f = e => i => e[i].toLowerCase().indexOf(string.toLowerCase()) !== -1 || string.toLowerCase() === i.toLowerCase() && !!e[i]
            }
            
        }
        let res = resources.filter(e => 
            Object.keys(e)
                    .map(f(e))
                    .reduce((a, b) => a || b));
        print(res.length, 'items found');
        return res;
    }
    const res = _find(resources, string, isCaseSensitive, firstOnly)
    if (string) {
        dbCache.find = dbCache.find || {}
        dbCache.find.last = {
            resource: resource == 'last' ? dbCache.find.last.resource : resource, 
            history: (resource == 'last' ? [...dbCache.find.last.history, [string, isCaseSensitive, firstOnly]] : [[string, isCaseSensitive, firstOnly]]).filter(i => i)
        }
    }
    debug('dbCache-end', dbCache.find)
    return res;
}