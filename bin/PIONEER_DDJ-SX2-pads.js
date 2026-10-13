// Performance pads and their modes, called with (channel, control, value, status).
// Pad mode buttons are on the deck channels (0-3), pads on channels 7-10.

// PAD MODES //

// each mode button's LED has the same note as the button
PioneerDDJSX2.padModeNotes = {
    0x1B: PioneerDDJSX2.padModes.hotCue,
    0x1E: PioneerDDJSX2.padModes.roll,
    0x20: PioneerDDJSX2.padModes.beatJump,
    0x22: PioneerDDJSX2.padModes.sampler,
    0x69: PioneerDDJSX2.padModes.cueLoop,
    0x6B: PioneerDDJSX2.padModes.savedLoop,
    0x6D: PioneerDDJSX2.padModes.slicerLoop,
    0x6F: PioneerDDJSX2.padModes.velocitySampler,
};

PioneerDDJSX2.setPadMode = function(channel, control, value) {
    if (value !== 0x7F) {
        return;
    }
    const P = PioneerDDJSX2;
    const mode = P.padModeNotes[control];
    P.padMode[channel] = mode;
    let color = 0x7F;
    switch (mode) {
    case P.padModes.roll:
        color = P.settings.rollColors[P.rollPrec[channel]];
        break;
    case P.padModes.sampler:
    case P.padModes.velocitySampler:
        P.repaintSampler(channel);
        break;
    case P.padModes.cueLoop:
        color = P.settings.cueLoopColor;
        P.cueLoopLeds(channel);
        break;
    case P.padModes.slicerLoop: {
        const beat = P.currentBeat(P.deckGroup(channel)) % 8;
        for (let i = 0; i < 8; i++) {
            P.padLed(channel, 0x60 + i, beat === i ? 0x28 : 0x01);
        }
        break;
    }
    }
    midi.sendShortMsg(0x90 + channel, control, color);
};

// pad mode parameter buttons, dir = -1 (left) or 1 (right)

PioneerDDJSX2.rollParam = dir => function(channel, control, value) {
    if (value === 0x7F) {
        const prec = Math.max(0, Math.min(4, PioneerDDJSX2.rollPrec[channel] + dir));
        PioneerDDJSX2.rollPrec[channel] = prec;
        midi.sendShortMsg(0x90 + channel, 0x1E, PioneerDDJSX2.settings.rollColors[prec]);
    }
};

PioneerDDJSX2.beatJumpParam = dir => function(channel, control, value) {
    if (value === 0x7F) {
        const prec = Math.max(0, Math.min(8, PioneerDDJSX2.beatjumpPrec[channel] + dir));
        PioneerDDJSX2.beatjumpPrec[channel] = prec;
        midi.sendShortMsg(0x90 + channel, 0x20, PioneerDDJSX2.settings.beatjumpColors[prec]);
    }
};

// 8 banks of 8 samplers
PioneerDDJSX2.samplerParam = dir => function(channel, control, value) {
    const bank = PioneerDDJSX2.samplerBank[channel] + dir;
    if (value === 0x7F && bank >= 0 && bank < 8) {
        PioneerDDJSX2.samplerBank[channel] = bank;
        PioneerDDJSX2.repaintSampler(channel);
    }
};

PioneerDDJSX2.cueLoopParam = key => function(channel, control, value) {
    engine.setValue(PioneerDDJSX2.deckGroup(channel), key, value === 0x7F ? 1 : 0);
};

// PADS (MIDI channel 7-10 = deck 1-4) //

// upper row jumps forward, lower row backward
PioneerDDJSX2.beatJumpPad = function(channel, control, value) {
    const deck = channel - 7;
    const which = (control & 3) + PioneerDDJSX2.beatjumpPrec[deck];
    if (value === 0x7F) {
        const interval = PioneerDDJSX2.settings.loopIntervals[which];
        const direction = control & 4 ? "backward" : "forward";
        engine.setValue(PioneerDDJSX2.deckGroup(deck), `beatjump_${interval}_${direction}`, 1);
    }
    midi.sendShortMsg(0x90 + channel, control, value === 0x7F ? PioneerDDJSX2.settings.beatjumpColors[which] : 0x00);
};

PioneerDDJSX2.rollPad = function(channel, control, value) {
    const deck = channel - 7;
    const prec = PioneerDDJSX2.rollPrec[deck];
    const interval = PioneerDDJSX2.settings.loopIntervals[control - 0x10 + prec];
    engine.setValue(PioneerDDJSX2.deckGroup(deck), `beatlooproll_${interval}_activate`, value === 0x7F ? 1 : 0);
    midi.sendShortMsg(0x90 + channel, control, value === 0x7F ? PioneerDDJSX2.settings.rollColors[prec] : 0x00);
};

// press: loop from the hot cue, beatloop_size long. press the same pad again to exit.
PioneerDDJSX2.hotCueLoop = function(channel, control, value) {
    if (value !== 0x7F) {
        return;
    }
    const P = PioneerDDJSX2;
    const deck = channel - 7;
    const group = P.deckGroup(deck);
    const pad = control & 7;
    if (!P.cueLoopOn[deck] || control >= 0x48 || P.cueLoopPad[deck] !== pad) {
        engine.setValue(group, `hotcue_${pad + 1}_activate`, 1);
        // read after activating: activating an empty hot cue sets it
        const start = engine.getValue(group, `hotcue_${pad + 1}_position`);
        const beatLength = engine.getValue(group, "track_samplerate") * 120 / engine.getValue(group, "file_bpm");
        engine.setValue(group, "loop_start_position", start);
        engine.setValue(group, "loop_end_position", start + beatLength * engine.getValue(group, "beatloop_size"));
        P.setLoop(group, true);
        P.stopCueLoop(deck); // restore the previous pad
        P.cueLoopOn[deck] = true;
        P.cueLoopPad[deck] = pad;
    } else {
        P.setLoop(group, false);
        P.stopCueLoop(deck);
    }
};

// pad 0x50+i saves/recalls hot cues 16+2i (start) and 17+2i (end)
PioneerDDJSX2.savedLoop = function(channel, control, value) {
    if (value !== 0x7F) {
        return;
    }
    const group = PioneerDDJSX2.deckGroup(channel - 7);
    const start = `hotcue_${(control - 0x48) * 2}`;
    const end = `hotcue_${(control - 0x48) * 2 + 1}`;
    const loopStart = engine.getValue(group, "loop_start_position");
    const loopEnd = engine.getValue(group, "loop_end_position");
    if (engine.getValue(group, `${start}_position`) === -1) {
        if (loopStart !== -1 && loopEnd !== -1) {
            engine.setValue(group, `${start}_set`, 1);
            engine.setValue(group, `${end}_set`, 1);
            engine.setValue(group, `${start}_position`, loopStart);
            engine.setValue(group, `${end}_position`, loopEnd);
        }
    } else {
        engine.setValue(group, "loop_start_position", engine.getValue(group, `${start}_position`));
        engine.setValue(group, "loop_end_position", engine.getValue(group, `${end}_position`));
        PioneerDDJSX2.setLoop(group, true);
    }
};

PioneerDDJSX2.clearSavedLoop = function(channel, control, value) {
    if (value === 0x7F) {
        const group = PioneerDDJSX2.deckGroup(channel - 7);
        const n = (control - 0x50) * 2;
        engine.setValue(group, `hotcue_${n}_clear`, 1);
        engine.setValue(group, `hotcue_${n + 1}_clear`, 1);
    }
};

// SAMPLERS: pad = slot in the deck's current bank //

PioneerDDJSX2.samplerIndex = (channel, control) => (control & 7) + PioneerDDJSX2.samplerBank[channel - 7] * 8;

// an empty pad loads the track selected in the library
PioneerDDJSX2.samplerPlay = function(channel, control, value) {
    const sampler = `[Sampler${1 + PioneerDDJSX2.samplerIndex(channel, control)}]`;
    const key = engine.getValue(sampler, "track_loaded") ? "start_play" : "LoadSelectedTrack";
    engine.setParameter(sampler, key, value & 1);
};

PioneerDDJSX2.samplerStop = function(channel, control, value) {
    engine.setParameter(`[Sampler${1 + PioneerDDJSX2.samplerIndex(channel, control)}]`, "start_stop", value & 1);
};

// pregain = master sampler volume * this pad's volume
PioneerDDJSX2.setSampleGain = function(channel, control, value) {
    const i = PioneerDDJSX2.samplerIndex(channel, control);
    PioneerDDJSX2.sampleVolume[i] = value / 127;
    engine.setParameter(`[Sampler${1 + i}]`, "pregain", PioneerDDJSX2.samplerVolume * PioneerDDJSX2.sampleVolume[i]);
};

PioneerDDJSX2.setSamplerVolume = function(channel, control, value) {
    PioneerDDJSX2.samplerVolume = value / 127;
    for (let i = 0; i < engine.getValue("[App]", "num_samplers"); i++) {
        engine.setParameter(`[Sampler${i + 1}]`, "pregain", PioneerDDJSX2.samplerVolume * PioneerDDJSX2.sampleVolume[i]);
    }
};
