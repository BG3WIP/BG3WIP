const fs = require('node:fs');
const readline = require('readline-sync');
const path = require('node:path');
const { line, log, debug, print, usage, obj, error, timed, logged, cache } = require('./.js/lib/common');
if(!fs.existsSync('./.globals.js')) {
    fs.writeFileSync('./.globals.js', 'module.exports = {}')
}

const globals = require('./.globals.js');
log(globals);
if (!globals.workDir) {
    globals.workDir = readline.prompt({prompt: 'Where will you store your mods? > '});
    fs.writeFileSync('./.globals.js', 'module.exports = ' + JSON.stringify(globals, undefined, 2));
}

debug(globals)
const workplace = path.normalize(globals.workDir + '/' + '.config.js');

const defaultConfig = obj();
defaultConfig.show = 5;
const config = cache(workplace, defaultConfig);


const mod = require('./.js/mod');
const db = require('./.js/db');

const { dumpToFile } = require('./.js/lib/file');

if (!config.gameDir) {
    config.gameDir = readline.prompt({prompt: 'Where is BG3 installed? > '})
    const unpackedGameAssets = readline.prompt({prompt: `You should've already unpacked Patch1, Gustav and Shared mods somewhere, where exactly may I ask? If they're not there yet I can wait while you do it. > `});
    config.unpackedGameAssets = {
        'Patch1': unpackedGameAssets + '/Patch1',
        'Gustav': unpackedGameAssets + '/Gustav',
        'Shared': unpackedGameAssets + '/Shared',
    }
}

debug(process.argv)

const runtime = {
    showAll: false,
    yes: false,
}

const modules = {
    help,
    config: (param, value) => {
        let c = config, path = param.split('.');
        path.map((p,i) => i === path.length - 1 ? c[p] = value : c = c[p])
    },
    db,
    mod: mod(db, runtime, config),
    c: 'config',
}

const params = {
    '--dump' : {
        after: true,
        callback: function dump(filename, result, arguments, ) {
            print('Dumping', call.name ?? 'result','to', filename)
            return dumpToFile(filename, result, arguments, )
        },
        help: `Save command result to file, e.g.:
node bg3 db:values:Data/Armor.txt Boosts --dump test/Boosts.csv
`
    },
    '--all' : {
        after: true,
        callback: () => runtime.showAll = true,
        help: `Show all entries of result regardless of "show" param`
    },
    '--yes' : {
        callback: () => runtime.yes = true,
        help: `Autoanswers yes to prompts.`
    },
}

function help () {
    print('### USAGE ###')
    Object.values(usage).map(m => m && print(m))    
    print('### AVAILABLE PARAMETERS ###')
    Object.keys(params).map(k => params[k].help ? print (k, params[k].help) : print(k))
    print('### CONTENTS ###')
    console.dir(modules)
    process.exit(0);
}


let input = process.argv[2];
if (!input) help();
let args = process.argv.splice(3);
let call;
let [command, ...addArgs] = input.split(':');
if (modules[command] === '' + modules[command]) {
    command = modules[command];
}
if (modules[command] && modules[command][addArgs[0]]) {
    debug('Nested call', command, addArgs)
    let depth = 0, _command = addArgs[depth], module = modules[command];
    while (_command = module[_command]) {
        module = _command
        _command = addArgs[depth]
        depth++
    }
    call = (module)[addArgs[depth]] || module
    debug('Reached', module, depth, addArgs, args)
    if(addArgs.length > depth + 1) {
        args = [addArgs.splice(depth + 1).join(':'), ...args, ]
    }    
} else {
    debug('Command', command)
    call = modules[command]
}
debug(call, args)
if (call && call.apply) {
    const runParams = obj();
    args.map((arg, pos) => arg.indexOf('--')  === 0 && (runParams.params[pos] = arg)).filter(i => i)
    debug(runParams)
    const LC_BEFORE = [], LC_AFTER = [];
    runParams.pos = Object.keys(runParams.params).map(k=>+k).sort((a,b) => a >b );
    if (runParams.pos[0] !== undefined) {
        runParams.args = args.splice(runParams.pos[0])
        debug(runParams,args)
        runParams.parsed = runParams.pos.map((k, i) => ({
                command: runParams.params[k],
                args: runParams.args.splice(1, runParams.pos[i + 1] ? runParams.pos[i + 1] - runParams.pos[i] : runParams.args.length) 
        }))
        runParams.parsed.map(p => 
            params[p.command] ? 
            (params[p.command].after ? 
                debug('LCA', p) || LC_AFTER.push(params[p.command].callback.bind(params[p.command].callback, ...p.args)) :
                LC_BEFORE.push(params[p.command].callback.bind(params[p.command].callback, ...p.args))
            ) 
            : log(p.command, 'not recognized'))
        debug('options', runParams)
        // args = args.splice(runParams.pos[0])
        debug('args', args)
    }
    // return;
    debug('Executing', call.name, args)
    LC_BEFORE.map(f => f.apply(f, [call, args]))
    if (LC_BEFORE.length) debug(LC_BEFORE.length, 'before triggers fired')
    let result = call.apply(call, args)
    LC_AFTER.map(f => debug(f) || f.apply(f, [result, call, args]))
    if (LC_AFTER.length) debug(LC_AFTER.length, 'after triggers fired')
    debug(call.displayName ?? call.name, 'exited');
    if (result instanceof Array) {
        const display = result.length > config.show && !runtime.showAll ? result.slice(0, config.show) : result
        print(display);
        print(result.length, 'rows total', ...(result.length == display.length ? [] : [', first', display.length, 'shown']))
    } else {
        print(result || '<Empty result set>')
    }
} else {    
    error('Something went wrong', call)
    if (!config.settings.LOG_LEVEL) help()
}