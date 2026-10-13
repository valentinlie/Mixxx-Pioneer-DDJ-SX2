// Deck, mixer, effect, browser and jog wheel handlers, called with (channel, control, value, status).

// DECK BUTTONS //

// sync buttons act on deck pairs 1+2 / 3+4
PioneerDDJSX2.syncPair = on => function(channel, control, value) {
    if (value === 0x7F) {
        const first = channel & ~1;
        engine.setValue(PioneerDDJSX2.deckGroup(first), "sync_enabled", on);
        engine.setValue(PioneerDDJSX2.deckGroup(first + 1), "sync_enabled", on);
    }
};

PioneerDDJSX2.slip = function(channel, control, value) {
    if (value === 0x7F) {
        const group = PioneerDDJSX2.deckGroup(channel);
        const on = !engine.getValue(group, "slip_enabled");
        engine.setValue(group, "slip_enabled", on);
        if (engine.getValue(group, "play")) {
            midi.sendShortMsg(0x90 + channel, 0x3E, on ? 0x7F : 0x00);
        }
    }
};

PioneerDDJSX2.reverseButton = function(channel, control, value) {
    if (value === 0x7F) {
        PioneerDDJSX2.reverse[channel] = !PioneerDDJSX2.reverse[channel];
        engine.setValue(PioneerDDJSX2.deckGroup(channel), "reverse", PioneerDDJSX2.reverse[channel]);
    }
};

PioneerDDJSX2.inputSelect = function(channel, control, value) {
    engine.setValue(PioneerDDJSX2.deckGroup(channel), "mute", value ? 1 : 0);
};

PioneerDDJSX2.loopIn = function(channel, control, value) {
    const group = PioneerDDJSX2.deckGroup(channel);
    engine.setValue(group, "loop_in", value ? 1 : 0);
    if (value === 0x7F) {
        PioneerDDJSX2.closestBeatToLoopIn[channel] = engine.getValue(group, "beat_closest");
    }
};

// 4 beat loop from the last loop-in point
PioneerDDJSX2.fourBeat = function(channel, control, value) {
    if (value === 0x7F) {
        const group = PioneerDDJSX2.deckGroup(channel);
        const start = PioneerDDJSX2.closestBeatToLoopIn[channel];
        const length = engine.getValue(group, "track_samplerate") * 480 / engine.getValue(group, "file_bpm");
        engine.setValue(group, "loop_start_position", start);
        engine.setValue(group, "loop_end_position", start + length);
        PioneerDDJSX2.setLoop(group, true);
    }
};

PioneerDDJSX2.autoLoop = function(channel, control, value) {
    if (value === 0x7F) {
        const group = PioneerDDJSX2.deckGroup(channel);
        if (engine.getValue(group, "loop_enabled")) {
            engine.setValue(group, "reloop_toggle", 1);
            PioneerDDJSX2.stopCueLoop(channel);
        } else {
            engine.setValue(group, "beatloop_activate", 1);
        }
    }
};

PioneerDDJSX2.setTempoRange = function(channel, control, value) {
    if (value === 0x7F) {
        const ranges = PioneerDDJSX2.settings.tempoRanges;
        PioneerDDJSX2.tempoRange[channel] = (PioneerDDJSX2.tempoRange[channel] + 1) % ranges.length;
        engine.setValue(PioneerDDJSX2.deckGroup(channel), "rateRange", ranges[PioneerDDJSX2.tempoRange[channel]]);
    }
};

PioneerDDJSX2.toggleVinyl = function(channel, control, value) {
    if (value === 0x7F) {
        PioneerDDJSX2.vinylOn[channel] = !PioneerDDJSX2.vinylOn[channel];
    }
};

PioneerDDJSX2.setGridSlide = function(channel, control, value) {
    PioneerDDJSX2.gridSlide[channel] = Boolean(value);
    midi.sendShortMsg(0x90 + channel, 0x0A, value ? 0x7F : 0x00);
};

PioneerDDJSX2.setGridAdjust = function(channel, control, value) {
    PioneerDDJSX2.gridAdjust[channel] = Boolean(value);
    midi.sendShortMsg(0x90 + channel, 0x79, value ? 0x7F : 0x00);
};

// shortcut: Mixxx has no control to clear a beat grid, so this only lights the button
PioneerDDJSX2.clearGrid = function(channel, control, value) {
    midi.sendShortMsg(0x90 + channel, 0x79, value ? 0x7F : 0x00);
};

PioneerDDJSX2.crossfaderCurve = function(channel, control, value) {
    engine.setValue("[Mixer Profile]", "xFaderCurve", value / 16);
};

// EFFECTS (MIDI channel 4/5 = effect unit 1/2) //

PioneerDDJSX2.effectSelect = function(channel, control, value) {
    const effect = `[EffectRack1_EffectUnit${channel - 3}_Effect${control - 0x62}]`;
    engine.setValue(effect, "effect_selector", value === 0x7F ? 1 : 0);
};

PioneerDDJSX2.effectJog = function(channel, control, value) {
    const unit = `[EffectRack1_EffectUnit${channel - 3}]`;
    const delta = value > 63 ? value - 128 : value;
    engine.setValue(unit, "mix", engine.getValue(unit, "mix") + 0.0625 * delta);
};

// knobs are CC 2/4/6 -> effect 1/2/3
PioneerDDJSX2.effectKnob = function(channel, control, value) {
    engine.setValue(`[EffectRack1_EffectUnit${channel - 3}_Effect${control / 2}]`, "meta", value / 127);
};

PioneerDDJSX2.effectButton = function(channel, control, value) {
    if (value === 0x7F) {
        const effect = `[EffectRack1_EffectUnit${channel - 3}_Effect${control - 0x46}]`;
        engine.setValue(effect, "enabled", !engine.getValue(effect, "enabled"));
    }
};

PioneerDDJSX2.effectTap = function(channel, control, value) {
    if (value === 0x7F) {
        const unit = `[EffectRack1_EffectUnit${channel - 3}]`;
        engine.setValue(unit, "mix_mode", !engine.getValue(unit, "mix_mode"));
    }
};

// BROWSER AND VIEW //

// 0x78 = next, 0x79 = previous; panels: 0 none, 1 samplers, 2 effects
PioneerDDJSX2.panelSelect = function(channel, control, value) {
    if (value === 0x7F) {
        PioneerDDJSX2.curPanel = (PioneerDDJSX2.curPanel + (control === 0x78 ? 1 : 2)) % 3;
        engine.setValue("[Skin]", "show_samplers", PioneerDDJSX2.curPanel === 1 ? 1 : 0);
        engine.setValue("[Skin]", "show_effectrack", PioneerDDJSX2.curPanel === 2 ? 1 : 0);
    }
};

// cycles through all 8 combinations of 4 decks / parallel waveforms (Deere only) / hidden mixer
PioneerDDJSX2.viewButton = function(channel, control, value) {
    if (value === 0x7F) {
        PioneerDDJSX2.curView = (PioneerDDJSX2.curView + 1) % 8;
        const view = PioneerDDJSX2.curView;
        engine.setValue("[Skin]", "show_4decks", view & 1 ? 1 : 0);
        engine.setValue("[Deere]", "show_parallel_waveforms", view & 2 ? 1 : 0);
        engine.setValue("[Skin]", "show_mixer", view & 4 ? 0 : 1);
    }
};

PioneerDDJSX2.libraryWidget = {sidebar: 2, tracks: 3}; // [Library],focused_widget values

// scrolls whichever library pane has focus
PioneerDDJSX2.rotarySelector = function(channel, control, value) {
    engine.setValue("[Library]", "MoveVertical", value > 0x40 ? value - 0x80 : value); // two's complement
};

PioneerDDJSX2.rotarySelectorClick = function(channel, control, value) {
    if (value === 0x7F) {
        const widget = PioneerDDJSX2.libraryWidget;
        const sidebar = engine.getValue("[Library]", "focused_widget") === widget.sidebar;
        engine.setValue("[Library]", "focused_widget", sidebar ? widget.tracks : widget.sidebar);
    }
};

PioneerDDJSX2.backButton = function(channel, control, value) {
    if (value === 0x7F) {
        engine.setValue("[Library]", "focused_widget", PioneerDDJSX2.libraryWidget.sidebar);
    }
};

// JOG WHEELS //

// The wheel centers on 0x40.
PioneerDDJSX2.jogDelta = value => value - 0x40;

PioneerDDJSX2.toggleScratch = function(channel, enable) {
    const settings = PioneerDDJSX2.settings;
    if (enable) {
        engine.scratchEnable(channel + 1, settings.jogResolution, settings.vinylSpeed, settings.alpha, settings.beta);
    } else {
        engine.scratchDisable(channel + 1);
    }
};

// less sensitive, limited to -3..3
PioneerDDJSX2.pitchBend = function(channel, movement) {
    engine.setValue(PioneerDDJSX2.deckGroup(channel), "jog", Math.max(-3, Math.min(3, movement / 5)));
};

// Disabling scratch right on release causes a pitch bend from the still-spinning
// wheel, so disable it after a short timeout that every wheel tick postpones.
PioneerDDJSX2.scheduleDisableScratch = function(channel) {
    PioneerDDJSX2.unscheduleDisableScratch(channel);
    PioneerDDJSX2.disableScratchTimer[channel] = engine.beginTimer(PioneerDDJSX2.settings.safeScratchTimeout, () => {
        PioneerDDJSX2.disableScratchTimer[channel] = 0;
        PioneerDDJSX2.toggleScratch(channel, false);
    }, true);
};

PioneerDDJSX2.unscheduleDisableScratch = function(channel) {
    if (PioneerDDJSX2.disableScratchTimer[channel]) {
        engine.stopTimer(PioneerDDJSX2.disableScratchTimer[channel]);
        PioneerDDJSX2.disableScratchTimer[channel] = 0;
    }
};

// touch/release in vinyl mode
PioneerDDJSX2.jogScratchTouch = function(channel, control, value) {
    if (value === 0x7F && PioneerDDJSX2.vinylOn[channel]) {
        PioneerDDJSX2.unscheduleDisableScratch(channel);
        PioneerDDJSX2.toggleScratch(channel, true);
    } else {
        PioneerDDJSX2.scheduleDisableScratch(channel);
    }
};

PioneerDDJSX2.jogSeek = function(channel, control, value) {
    engine.setValue(PioneerDDJSX2.deckGroup(channel), "beatjump", PioneerDDJSX2.jogDelta(value) / 16);
};

// top of the wheel: scratch, or nudge the beat grid while grid slide/adjust is held
PioneerDDJSX2.jogScratchTurn = function(channel, control, value) {
    const group = PioneerDDJSX2.deckGroup(channel);
    const gridSlide = PioneerDDJSX2.gridSlide[channel];
    const gridAdjust = PioneerDDJSX2.gridAdjust[channel];
    if (engine.isScratching(channel + 1) && !gridSlide && !gridAdjust) {
        engine.scratchTick(channel + 1, PioneerDDJSX2.jogDelta(value));
        return;
    }
    if (gridSlide) {
        engine.setValue(group, value < 64 ? "beats_translate_earlier" : "beats_translate_later", 1);
    }
    if (gridAdjust) {
        engine.setValue(group, value < 64 ? "beats_adjust_faster" : "beats_adjust_slower", 1);
    }
};

// side of the wheel: pitch bend, or finish a scratch while the wheel still spins
PioneerDDJSX2.jogPitchBend = function(channel, control, value) {
    if (engine.isScratching(channel + 1)) {
        engine.scratchTick(channel + 1, PioneerDDJSX2.jogDelta(value));
        PioneerDDJSX2.scheduleDisableScratch(channel);
    } else if (engine.getValue(PioneerDDJSX2.deckGroup(channel), "play")) {
        PioneerDDJSX2.pitchBend(channel, PioneerDDJSX2.jogDelta(value));
    }
};

// touch when not in vinyl mode: scratch only while stopped, otherwise turning pitch-bends
PioneerDDJSX2.jogSeekTouch = function(channel, control, value) {
    if (!engine.getValue(PioneerDDJSX2.deckGroup(channel), "play")) {
        PioneerDDJSX2.toggleScratch(channel, value === 0x7F);
    }
};

PioneerDDJSX2.jogSeekTurn = function(channel, control, value) {
    if (engine.isScratching(channel + 1)) {
        engine.scratchTick(channel + 1, PioneerDDJSX2.jogDelta(value));
    } else {
        PioneerDDJSX2.pitchBend(channel, PioneerDDJSX2.jogDelta(value));
    }
};
