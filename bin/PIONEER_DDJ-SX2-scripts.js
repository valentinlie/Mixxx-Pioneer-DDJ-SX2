// Pioneer DDJ-SX2 mapping for Mixxx 2.4+
// based on hrudham's mapping for the DDJ-SR
// modifications by tildearrow
// thanks to:
// hrudham for making the DDJ-SR mapping
// pioneer for making such an awesome controller
// license: (MIT)
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// Script files, loaded in this order by the .midi.xml:
//   PIONEER_DDJ-SX2-scripts.js   settings, state, helpers, init/shutdown, MIDI input table
//   PIONEER_DDJ-SX2-lights.js    LED feedback from Mixxx controls
//   PIONEER_DDJ-SX2-controls.js  deck, effect, browser and jog wheel handlers
//   PIONEER_DDJ-SX2-pads.js      performance pads and their modes
//
// Input handlers get (channel, control, value, status), LED callbacks get (value, group, control).

// Mixxx looks up init/shutdown on the global object, so this has to be a var.
// eslint-disable-next-line no-var
var PioneerDDJSX2 = {};

// keeps the controller in Serato mode, which enables needle position, beat indicator and slip flash
PioneerDDJSX2.keepAlive = [0xF0, 0x00, 0x20, 0x7F, 0x50, 0x01, 0xF7];

PioneerDDJSX2.settings = {
    alpha: 1 / 8,
    beta: 1 / 8 / 32,
    jogResolution: 2054, // 2054 for accurate scratches (until we find a more accurate value)
    vinylSpeed: 33 + 1 / 3,
    safeScratchTimeout: 20, // ms, the minimum Mixxx allows
    loopIntervals: ["0.03125", "0.0625", "0.125", "0.25", "0.5", "1", "2", "4", "8", "16", "32", "64"],
    tempoRanges: [0.08, 0.16, 0.5, 0.9],
    rollColors: [0x1D, 0x16, 0x13, 0x0D, 0x05],
    // one per loop interval that beat jump can reach (precision 0..8 + pad 0..3)
    beatjumpColors: [0x3C, 0x3A, 0x38, 0x36, 0x34, 0x32, 0x30, 0x2E, 0x2C, 0x2A, 0x28, 0x26],
    cueLoopColor: 0x01,
    // user preferences from the .midi.xml <settings>, read in init()
    centerLight: "beats",
    seratoMode: true,
};

PioneerDDJSX2.padModes = {
    hotCue: 0,
    roll: 1,
    beatJump: 2, // the SLICER button
    sampler: 3,
    cueLoop: 4,
    savedLoop: 5,
    slicerLoop: 6,
    velocitySampler: 7,
};

// general state
PioneerDDJSX2.lightsTimer = 0;
PioneerDDJSX2.blinkState = false;
PioneerDDJSX2.curPanel = 0; // 0 none, 1 samplers, 2 effects
PioneerDDJSX2.curView = 0;
PioneerDDJSX2.conns = [];

// per-deck state
PioneerDDJSX2.reverse = [false, false, false, false];
PioneerDDJSX2.vinylOn = [true, true, true, true];
PioneerDDJSX2.padMode = [0, 0, 0, 0];
PioneerDDJSX2.tempoRange = [0, 0, 0, 0]; // index into settings.tempoRanges
PioneerDDJSX2.closestBeatToLoopIn = [0, 0, 0, 0];
PioneerDDJSX2.gridSlide = [false, false, false, false];
PioneerDDJSX2.gridAdjust = [false, false, false, false];
PioneerDDJSX2.jogRingPos = [-1, -1, -1, -1];
PioneerDDJSX2.disableScratchTimer = [0, 0, 0, 0];
PioneerDDJSX2.rollPrec = [2, 2, 2, 2];
PioneerDDJSX2.beatjumpPrec = [2, 2, 2, 2];
PioneerDDJSX2.samplerBank = [0, 0, 0, 0];
PioneerDDJSX2.cueLoopOn = [false, false, false, false];
PioneerDDJSX2.cueLoopPad = [0, 0, 0, 0];

// sampler state
PioneerDDJSX2.samplerVolume = 1;
PioneerDDJSX2.sampleVolume = new Array(64).fill(0.5);

// HELPERS //

PioneerDDJSX2.deckGroup = deck => `[Channel${deck + 1}]`;

// "[Channel3]" -> 2, "[Sampler12]" -> 11 (both prefixes are 8 characters)
PioneerDDJSX2.groupIndex = group => parseInt(group.substring(8)) - 1;

// every performance pad has a second LED 8 notes up (the shifted pad)
PioneerDDJSX2.padLed = function(deck, note, color) {
    midi.sendShortMsg(0x97 + deck, note, color);
    midi.sendShortMsg(0x97 + deck, note + 0x08, color);
};

// beat number of the playhead, used for beat-synced lights; -1 without a track
PioneerDDJSX2.currentBeat = function(group) {
    const seconds = engine.getValue(group, "beat_next") / engine.getValue(group, "track_samplerate") / 2; // stereo
    const beat = Math.round(seconds * engine.getValue(group, "file_bpm") / 60) - 1;
    return Number.isNaN(beat) ? -1 : beat;
};

// reloop_toggle toggles, so only press it when the loop isn't already in the wanted state
PioneerDDJSX2.setLoop = function(group, on) {
    if (Boolean(engine.getValue(group, "loop_enabled")) !== on) {
        engine.setValue(group, "reloop_toggle", 1);
        engine.setValue(group, "reloop_toggle", 0);
    }
};

PioneerDDJSX2.stopCueLoop = function(deck) {
    if (PioneerDDJSX2.cueLoopOn[deck]) {
        PioneerDDJSX2.cueLoopOn[deck] = false;
        PioneerDDJSX2.cueLoopLeds(deck); // the blink may have left the pad dark
    }
};

PioneerDDJSX2.setFilterResonance = function() {
    for (let i = 1; i <= 4; i++) {
        engine.setValue(`[QuickEffectRack1_[Channel${i}]_Effect1]`, "parameter2", 4);
    }
};

// INIT/SHUTDOWN //

PioneerDDJSX2.init = function() {
    const settings = PioneerDDJSX2.settings;
    settings.centerLight = engine.getSetting("centerLight");
    settings.seratoMode = engine.getSetting("seratoMode");

    PioneerDDJSX2.setFilterResonance();
    for (let deck = 0; deck < 4; deck++) {
        midi.sendShortMsg(0xBB, deck, 0); // jog ring
        midi.sendShortMsg(0xBB, 4 + deck, 0); // jog center
        const range = settings.tempoRanges[PioneerDDJSX2.tempoRange[deck]];
        engine.setValue(PioneerDDJSX2.deckGroup(deck), "rateRange", range);
    }
    engine.setValue("[EffectRack1_EffectUnit1]", "group_[Channel1]_enable", 1);
    engine.setValue("[EffectRack1_EffectUnit2]", "group_[Channel2]_enable", 1);

    PioneerDDJSX2.bindInputs();
    PioneerDDJSX2.bindConnections(); // also paints all LEDs with the current state
    for (let deck = 0; deck < 4; deck++) {
        midi.sendShortMsg(0x90 + deck, 0x0B, 0x10); // play button decoration
        midi.sendShortMsg(0x90 + deck, 0x1B, 0x7F); // hot cue pad mode
        midi.sendShortMsg(0x90 + deck, 0x0D, 0x7F); // vinyl mode
    }
    PioneerDDJSX2.lightsTimer = engine.beginTimer(250, PioneerDDJSX2.blink);
};

PioneerDDJSX2.shutdown = function() {
    engine.stopTimer(PioneerDDJSX2.lightsTimer);
    PioneerDDJSX2.conns.forEach(conn => conn.disconnect());
    PioneerDDJSX2.conns = [];
    for (let deck = 0; deck < 4; deck++) {
        midi.sendShortMsg(0xB0 + deck, 0x02, 0); // VU meter
        midi.sendShortMsg(0xBB, deck, 0);
        midi.sendShortMsg(0xBB, 4 + deck, 0);
    }
};

// 250ms timer: Serato keep-alive and blinking LEDs
PioneerDDJSX2.blink = function() {
    PioneerDDJSX2.blinkState = !PioneerDDJSX2.blinkState;
    const on = PioneerDDJSX2.blinkState;
    if (PioneerDDJSX2.settings.seratoMode) {
        midi.sendSysexMsg(PioneerDDJSX2.keepAlive, PioneerDDJSX2.keepAlive.length);
    }
    for (let deck = 0; deck < 4; deck++) {
        const slip = on && engine.getValue(PioneerDDJSX2.deckGroup(deck), "slip_enabled");
        const reverse = on && PioneerDDJSX2.reverse[deck];
        midi.sendShortMsg(0x90 + deck, 0x40, slip ? 0x7F : 0x00);
        midi.sendShortMsg(0x90 + deck, 0x38, reverse ? 0x7F : 0x00);
        midi.sendShortMsg(0x90 + deck, 0x15, reverse ? 0x7F : 0x00);
        if (PioneerDDJSX2.cueLoopOn[deck]) {
            const color = on ? PioneerDDJSX2.settings.cueLoopColor : 0x00;
            PioneerDDJSX2.padLed(deck, 0x40 + PioneerDDJSX2.cueLoopPad[deck], color);
        }
    }
};

// CONNECTIONS //

// connect and paint the current state
PioneerDDJSX2.connect = function(group, key, callback) {
    const conn = engine.makeConnection(group, key, callback);
    if (conn) { // undefined if the control doesn't exist, e.g. samplers beyond the configured count
        PioneerDDJSX2.conns.push(conn);
        conn.trigger();
    }
};

PioneerDDJSX2.connectLed = function(group, key, status, note) {
    PioneerDDJSX2.connect(group, key, value => midi.sendShortMsg(status, note, value ? 0x7F : 0x00));
};

PioneerDDJSX2.bindConnections = function() {
    const P = PioneerDDJSX2;
    for (let deck = 0; deck < 4; deck++) {
        const group = P.deckGroup(deck);
        P.connect(group, "vu_meter", P.vuMeter);
        P.connect(group, "playposition", P.jogRingLeds);
        P.connect(group, "play_indicator", P.playLeds);
        P.connect(group, "rate", P.rateLeds);
        P.connect(group, "pitch_adjust", P.pitchAdjustLeds);
        P.connect(group, "beat_next", P.beatLeds);
        P.connect(group, "loop_enabled", P.loopLeds);
        P.connect(group, "loop_start_position", P.loopLeds);
        P.connect(group, "loop_end_position", P.loopLeds);
        P.connectLed(group, "sync_enabled", 0x90 + deck, 0x58);
        P.connectLed(group, "cue_indicator", 0x90 + deck, 0x48);
        P.connectLed(group, "cue_indicator", 0x90 + deck, 0x0C);
        P.connectLed(group, "pfl", 0x90 + deck, 0x54);
        P.connectLed(group, "keylock", 0x90 + deck, 0x1A);
        P.connectLed(group, "loop_double", 0x90 + deck, 0x13);
        P.connectLed(group, "loop_halve", 0x90 + deck, 0x12);
        for (let i = 1; i <= 8; i++) {
            P.connect(group, `hotcue_${i}_status`, P.hotCueLed);
            P.connect(group, `hotcue_${i}_color`, P.hotCueLed);
            P.connect(group, `hotcue_${14 + i * 2}_status`, P.savedLoopLeds);
        }
        // events, not state: don't trigger
        P.conns.push(engine.makeConnection(group, "eject", P.unloadLights));
        P.conns.push(engine.makeConnection(group, "track_samples", P.loadActions));
    }
    for (let unit = 0; unit < 2; unit++) {
        const unitGroup = `[EffectRack1_EffectUnit${unit + 1}]`;
        for (let deck = 0; deck < 4; deck++) {
            P.connectLed(unitGroup, `group_[Channel${deck + 1}]_enable`, 0x96, 0x4C + unit * 4 + deck);
        }
        for (let fx = 0; fx < 3; fx++) {
            P.connectLed(`[EffectRack1_EffectUnit${unit + 1}_Effect${fx + 1}]`, "enabled", 0x94 + unit, 0x47 + fx);
        }
        P.connectLed(unitGroup, "mix_mode", 0x94 + unit, 0x4A);
    }
    for (let i = 1; i <= engine.getValue("[App]", "num_samplers"); i++) {
        P.connect(`[Sampler${i}]`, "play", P.samplerLed);
        P.connect(`[Sampler${i}]`, "track_loaded", P.samplerLed);
    }
};

// MIDI INPUT //

PioneerDDJSX2.bindInputs = function() {
    const P = PioneerDDJSX2;
    // [first status, number of MIDI channels]
    const deck = [0x90, 4]; // deck buttons, channel = deck
    const deckCC = [0xB0, 4]; // jog wheels
    const fx = [0x94, 2]; // effect unit buttons, channel 4-5 = unit 1-2
    const fxCC = [0xB4, 2]; // effect unit knobs
    const browser = [0x96, 1]; // browser and global buttons
    const browserCC = [0xB6, 1]; // browser and global knobs
    const pads = [0x97, 4]; // performance pads, channel 7-10 = deck 1-4
    const padsCC = [0xB7, 4]; // velocity sampler gain
    const inputs = [
        // handler, statuses, first note, number of notes
        [P.setGridSlide, deck, 0x0A],
        [P.loopIn, deck, 0x10],
        [P.autoLoop, deck, 0x14],
        [P.toggleVinyl, deck, 0x17],
        [P.inputSelect, deck, 0x19],
        [P.setPadMode, deck, 0x1B],
        [P.setPadMode, deck, 0x1E],
        [P.setPadMode, deck, 0x20],
        [P.setPadMode, deck, 0x22],
        [P.setPadMode, deck, 0x69],
        [P.setPadMode, deck, 0x6B],
        [P.setPadMode, deck, 0x6D],
        [P.setPadMode, deck, 0x6F],
        [P.rollParam(-1), deck, 0x25],
        [P.rollParam(1), deck, 0x2D],
        [P.beatJumpParam(-1), deck, 0x26],
        [P.beatJumpParam(1), deck, 0x2E],
        [P.samplerParam(-1), deck, 0x27],
        [P.samplerParam(1), deck, 0x2F],
        [P.samplerParam(-1), deck, 0x2B],
        [P.samplerParam(1), deck, 0x33],
        [P.cueLoopParam("loop_halve"), deck, 0x28],
        [P.cueLoopParam("loop_double"), deck, 0x30],
        [P.jogSeekTouch, deck, 0x35],
        [P.jogScratchTouch, deck, 0x36],
        [P.reverseButton, deck, 0x38],
        [P.slip, deck, 0x40],
        [P.fourBeat, deck, 0x45],
        [P.syncPair(true), deck, 0x58],
        [P.syncPair(false), deck, 0x5C],
        [P.setTempoRange, deck, 0x60],
        [P.clearGrid, deck, 0x65],
        [P.setGridAdjust, deck, 0x79],
        [P.jogPitchBend, deckCC, 0x21],
        [P.jogScratchTurn, deckCC, 0x22],
        [P.jogSeekTurn, deckCC, 0x23],
        [P.jogSeek, deckCC, 0x26],
        [P.effectButton, fx, 0x47, 3],
        [P.effectTap, fx, 0x4A],
        [P.effectSelect, fx, 0x63, 3],
        [P.effectJog, fxCC, 0x00],
        [P.effectKnob, fxCC, 0x02],
        [P.effectKnob, fxCC, 0x04],
        [P.effectKnob, fxCC, 0x06],
        [P.rotarySelectorClick, browser, 0x41],
        [P.backButton, browser, 0x65],
        [P.viewButton, browser, 0x66],
        [P.panelSelect, browser, 0x78, 2],
        [P.crossfaderCurve, browserCC, 0x01],
        [P.setSamplerVolume, browserCC, 0x03],
        [P.rotarySelector, browserCC, 0x40],
        [P.rollPad, pads, 0x10, 8],
        [P.beatJumpPad, pads, 0x20, 8],
        [P.beatJumpPad, pads, 0x60, 8],
        [P.samplerPlay, pads, 0x30, 8],
        [P.samplerPlay, pads, 0x70, 8],
        [P.samplerStop, pads, 0x38, 8],
        [P.samplerStop, pads, 0x78, 8],
        [P.hotCueLoop, pads, 0x40, 16],
        [P.savedLoop, pads, 0x50, 8],
        [P.clearSavedLoop, pads, 0x58, 8],
        [P.setSampleGain, padsCC, 0x70, 8],
    ];
    for (const [handler, [status, channels], note, notes = 1] of inputs) {
        for (let s = status; s < status + channels; s++) {
            for (let n = note; n < note + notes; n++) {
                midi.makeInputHandler(s, n, handler);
            }
        }
    }
};
