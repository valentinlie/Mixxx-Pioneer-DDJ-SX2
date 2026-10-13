// LED feedback: callbacks for engine.makeConnection, called with (value, group, control).

// performance pad colors
// 0: off, 1: blue, 12: cyan, 22: green, 31: yellow, 41: red, 48: magenta, 62: blue,
// 63: black, 64: white (actually light blue), 65-126: invalid, 127: current mode default
PioneerDDJSX2.padColors = new ColorMapper({
    0x0000FF: 1,
    0x0010FF: 2,
    0x0028FF: 3,
    0x0040FF: 4,
    0x0060FF: 5,
    0x0080FF: 6,
    0x00A0FF: 7,
    0x00B0FF: 8,
    0x00D0FF: 9,
    0x00E0FF: 10,
    0x00F0FF: 11,

    0x00FFFF: 12,
    0x00FFF0: 13,
    0x00FFE0: 14,
    0x00FFD0: 15,
    0x00FFB0: 16,
    0x00FF90: 17,
    0x00FF70: 18,
    0x00FF50: 19,
    0x00FF30: 20,
    0x00FF10: 21,

    0x00FF00: 22,
    0x10FF00: 23,
    0x30FF00: 24,
    0x40FF00: 25,
    0x60FF00: 26,
    0x80FF00: 27,
    0xA0FF00: 28,
    0xC0FF00: 29,
    0xE0FF00: 30,

    0xFFFF00: 31,
    0xFFE000: 32,
    0xFFC000: 33,
    0xFFB000: 34,
    0xFFA000: 35,
    0xFF9000: 36,
    0xFF7000: 37,
    0xFF5000: 38,
    0xFF3000: 39,
    0xFF1000: 40,

    0xFF0000: 41,
    0xFF0020: 42,
    0xFF0030: 43,
    0xFF0060: 44,
    0xFF0090: 45,
    0xFF00A0: 46,
    0xFF00E0: 47,

    0xFF00FF: 48,
    0xF000FF: 49,
    0xE000FF: 50,
    0xD000FF: 51,
    0xC000FF: 52,
    0xB000FF: 53,
    0xA000FF: 54,
    0x9000FF: 55,
    0x8000FF: 56,
    0x6000FF: 57,
    0x5000FF: 58,
    0x4000FF: 59,
    0x3000FF: 60,
    0x2000FF: 61,
    0x1000FF: 62,

    0x000000: 63,
    0xF0FFFF: 64,
});

PioneerDDJSX2.vuMeter = function(value, group) {
    midi.sendShortMsg(0xB0 + PioneerDDJSX2.groupIndex(group), 0x02, Math.round(value * 127));
};

PioneerDDJSX2.playLeds = function(value, group) {
    const deck = PioneerDDJSX2.groupIndex(group);
    midi.sendShortMsg(0x90 + deck, 0x0B, value ? 0x7F : 0x00); // Play/Pause
    midi.sendShortMsg(0x90 + deck, 0x47, value ? 0x7F : 0x00); // Shift + Play/Pause
    if (!PioneerDDJSX2.settings.seratoMode) {
        midi.sendShortMsg(0x9B, 0x0C + deck, value ? 0x7F : 0x00); // play/pause animation
    }
};

// tempo direction triangles
PioneerDDJSX2.rateLeds = function(value, group) {
    const deck = PioneerDDJSX2.groupIndex(group);
    midi.sendShortMsg(0x90 + deck, 0x34, value > 0 ? 0x7F : 0x00);
    midi.sendShortMsg(0x90 + deck, 0x37, value < 0 ? 0x7F : 0x00);
};

PioneerDDJSX2.pitchAdjustLeds = function(value, group) {
    const deck = PioneerDDJSX2.groupIndex(group);
    midi.sendShortMsg(0x90 + deck, 0x4A, value < 0 ? 0x7F : 0x00);
    midi.sendShortMsg(0x90 + deck, 0x4B, value > 0 ? 0x7F : 0x00);
};

PioneerDDJSX2.unloadLights = function(value, group) {
    const deck = PioneerDDJSX2.groupIndex(group);
    for (let note = 0x00; note < 0x70; note++) {
        if (note < 0x30 || note >= 0x40) { // sampler pads keep their state
            midi.sendShortMsg(0x97 + deck, note, 0x00);
        }
    }
    midi.sendShortMsg(0xBB, deck, 0);
    midi.sendShortMsg(0xBB, 4 + deck, 0);
};

PioneerDDJSX2.loadActions = function(value, group) {
    if (value) {
        midi.sendShortMsg(0x9B, PioneerDDJSX2.groupIndex(group), 0x7F); // load animation
        PioneerDDJSX2.setFilterResonance();
    }
};

// jog center light counts beats
PioneerDDJSX2.beatLeds = function(value, group) {
    if (PioneerDDJSX2.settings.centerLight === "beats") {
        const deck = PioneerDDJSX2.groupIndex(group);
        midi.sendShortMsg(0xBB, 0x04 + deck, 1 + (PioneerDDJSX2.currentBeat(group) % 8));
    }
};

// jog ring shows the needle position of a turning 33 1/3 rpm platter
PioneerDDJSX2.jogRingLeds = function(value, group) {
    const deck = PioneerDDJSX2.groupIndex(group);
    const duration = engine.getValue(group, "track_samples") / engine.getValue(group, "track_samplerate") / 2; // stereo
    const segments = value * duration * 39.96; // 72 ring segments per turn, 0.555 turns per second
    const pos = duration ? Math.floor(1 + segments % 0x48) : 0; // NaN without a track: off
    if (pos !== PioneerDDJSX2.jogRingPos[deck]) {
        PioneerDDJSX2.jogRingPos[deck] = pos;
        midi.sendShortMsg(0xBB, deck, pos);
        if (PioneerDDJSX2.settings.centerLight === "rotations") {
            midi.sendShortMsg(0xBB, 0x04 + deck, pos && Math.floor(1 + segments / 0x48) % 8);
        }
    }
};

PioneerDDJSX2.loopLeds = function(value, group) {
    const deck = PioneerDDJSX2.groupIndex(group);
    const enabled = engine.getValue(group, "loop_enabled");
    midi.sendShortMsg(0x90 + deck, 0x14, enabled ? 0x7F : 0x00);
    midi.sendShortMsg(0x90 + deck, 0x10, engine.getValue(group, "loop_start_position") > -1 ? 0x7F : 0x00);
    midi.sendShortMsg(0x90 + deck, 0x11, engine.getValue(group, "loop_end_position") > -1 ? 0x7F : 0x00);
    PioneerDDJSX2.savedLoopLeds(0, group);
    if (!enabled) {
        PioneerDDJSX2.stopCueLoop(deck);
    }
};

// saved loops live in hot cues 16..31, two per pad (start, end)
PioneerDDJSX2.savedLoopLeds = function(value, group) {
    const deck = PioneerDDJSX2.groupIndex(group);
    const loopStart = engine.getValue(group, "loop_start_position");
    for (let i = 0; i < 8; i++) {
        const pos = engine.getValue(group, `hotcue_${16 + i * 2}_position`);
        let color = 0x00;
        if (pos > -1) {
            color = pos === loopStart ? 0x01 : 0x7F;
        }
        PioneerDDJSX2.padLed(deck, 0x50 + i, color);
    }
};

// handles both hotcue_N_status and hotcue_N_color
PioneerDDJSX2.hotCueLed = function(value, group, control) {
    const deck = PioneerDDJSX2.groupIndex(group);
    const n = parseInt(control.split("_")[1]);
    const on = engine.getValue(group, `hotcue_${n}_status`);
    const color = engine.getValue(group, `hotcue_${n}_color`);
    const padColor = on && color >= 0 ? PioneerDDJSX2.padColors.getValueForNearestColor(color) : 0x00;
    PioneerDDJSX2.padLed(deck, n - 1, padColor);
    PioneerDDJSX2.padLed(deck, 0x40 + n - 1, on ? PioneerDDJSX2.settings.cueLoopColor : 0x00);
};

PioneerDDJSX2.cueLoopLeds = function(deck) {
    for (let n = 1; n <= 8; n++) {
        PioneerDDJSX2.hotCueLed(0, PioneerDDJSX2.deckGroup(deck), `hotcue_${n}_status`);
    }
};

// sampler pad: off when empty, dim when playing, bright when loaded
PioneerDDJSX2.samplerPadLed = function(deck, pad) {
    const modes = PioneerDDJSX2.padModes;
    const mode = PioneerDDJSX2.padMode[deck];
    if (mode !== modes.sampler && mode !== modes.velocitySampler) {
        return;
    }
    const sampler = `[Sampler${1 + pad + PioneerDDJSX2.samplerBank[deck] * 8}]`;
    let color = 0x00;
    if (engine.getValue(sampler, "track_loaded")) {
        color = engine.getValue(sampler, "play") ? 0x40 : 0x7F;
    }
    PioneerDDJSX2.padLed(deck, (mode === modes.sampler ? 0x30 : 0x70) + pad, color);
};

PioneerDDJSX2.repaintSampler = function(deck) {
    for (let pad = 0; pad < 8; pad++) {
        PioneerDDJSX2.samplerPadLed(deck, pad);
    }
};

PioneerDDJSX2.samplerLed = function(value, group) {
    const sampler = PioneerDDJSX2.groupIndex(group);
    for (let deck = 0; deck < 4; deck++) {
        if (PioneerDDJSX2.samplerBank[deck] === sampler >> 3) {
            PioneerDDJSX2.samplerPadLed(deck, sampler & 7);
        }
    }
};
