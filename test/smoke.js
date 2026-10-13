// Smoke test: loads the mapping into a fake Mixxx and presses every mapped control.
// run: npm test
"use strict";
const fs = require("fs");
const assert = require("assert");
const vm = require("vm");

const bin = `${__dirname}/../bin/`;
const xml = fs.readFileSync(`${bin}PIONEER_DDJ-SX2.midi.xml`, "utf8");

// fake Mixxx
const values = {"[App]num_samplers": 16};
const sent = [];
const inputs = new Map(); // MIDI key -> handler
let conns = [];
const get = (group, key) => values[group + key] ?? (/position$/.test(key) ? -1 : 0);
const settings = {centerLight: "beats", seratoMode: true};
const midiKey = (status, note) => (status << 8) | note;
const mixxx = {
    engine: {
        getValue: get,
        setValue(group, key, value) {
            values[group + key] = Number(value);
            conns.filter(c => c.group === group && c.key === key).forEach(c => c.callback(Number(value), group, key));
        },
        setParameter(group, key, value) {
            values[group + key] = value;
        },
        getSetting: name => settings[name],
        makeConnection(group, key, callback) {
            const sampler = /^\[Sampler(\d+)\]$/.exec(group);
            if (sampler && sampler[1] > values["[App]num_samplers"]) {
                return undefined;
            }
            const conn = {
                group, key, callback,
                disconnect: () => { conns = conns.filter(c => c !== conn); },
                trigger: () => callback(get(group, key), group, key),
            };
            conns.push(conn);
            return conn;
        },
        beginTimer(ms, callback) {
            assert.strictEqual(typeof callback, "function");
            return 1;
        },
        stopTimer() {},
        scratchEnable() {},
        scratchDisable() {},
        scratchTick() {},
        isScratching: () => false,
    },
    midi: {
        sendShortMsg(status, note, value) {
            for (const byte of [status, note, value]) {
                assert(Number.isInteger(byte) && byte >= 0 && byte <= 0xFF, `bad MIDI ${status} ${note} ${value}`);
            }
            sent.push([status, note, value]);
        },
        sendSysexMsg() {},
        makeInputHandler(status, note, handler) {
            assert.strictEqual(typeof handler, "function", `no handler for ${status.toString(16)} ${note.toString(16)}`);
            assert(!inputs.has(midiKey(status, note)), `bound twice: ${status.toString(16)} ${note.toString(16)}`);
            inputs.set(midiKey(status, note), handler);
        },
    },
    ColorMapper: class {
        getValueForNearestColor() {
            return 1;
        }
    },
};

// load the script files in the order the XML lists them
const context = vm.createContext(mixxx);
const files = [...xml.matchAll(/<file [^>]*filename="([^"]+)"/g)].map(m => m[1]);
assert.strictEqual(files.length, 4);
files.forEach(file => vm.runInContext(fs.readFileSync(bin + file, "utf8"), context, {filename: file}));
const P = context.PioneerDDJSX2;

P.init();
assert(conns.length > 100, "connections bound");
assert(inputs.size > 500, "inputs bound");

// XML bindings and script bindings must not overlap: Mixxx ignores the script one
for (const [, status, note] of xml.matchAll(/<status>(\w+)<\/status>\s*<midino>(\w+)<\/midino>/g)) {
    assert(!inputs.has(midiKey(Number(status), Number(note))), `XML and script both bind ${status} ${note}`);
}

// press and release everything, in every pad mode
for (const mode of Object.values(P.padModes)) {
    P.padMode.fill(mode);
    for (const [key, handler] of inputs) {
        for (const value of [0x7F, 0x00]) {
            handler((key >> 8) & 0x0F, key & 0xFF, value, key >> 8);
        }
    }
}

// disabling a loop on one deck must not cancel another deck's cue loop
P.cueLoopOn = [true, true, false, false];
mixxx.engine.setValue("[Channel2]", "loop_enabled", 0);
assert.deepStrictEqual(P.cueLoopOn, [true, false, false, false]);

// tempo range is a real value, not a normalized parameter
assert.strictEqual(get("[Channel1]", "rateRange"), P.settings.tempoRanges[P.tempoRange[0]]);

P.shutdown();
assert.strictEqual(conns.length, 0, "all connections released");
console.log(`ok: ${inputs.size} inputs, ${sent.length} MIDI messages`);
