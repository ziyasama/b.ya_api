// Placeholder patch — deliberately plain, seam for the composer.
//
// Bed motion  <- sea level head (signed; 0.5 is level seas)
// Brightness  <- wind speed
// Texture     <- wave height and period
// Register    <- water temperature
// Articulation <- /bosphorus/event/gate  (bang, not a level)
//
// Incoming continuous values are already 0–1. Gate bangs are 1.0 pulses.
// Mute from /bosphorus/available/* in the composed patch, not here.

~voices.do(_.free);
~voices = List.new;

~bHead = ~bHead ?? { Bus.control(s, 1) }; ~bHead.set(0.5);
~bWind = ~bWind ?? { Bus.control(s, 1) }; ~bWind.set(0.2);
~bWaveH = ~bWaveH ?? { Bus.control(s, 1) }; ~bWaveH.set(0.1);
~bWaveP = ~bWaveP ?? { Bus.control(s, 1) }; ~bWaveP.set(0.4);
~bTemp = ~bTemp ?? { Bus.control(s, 1) }; ~bTemp.set(0.7);

~voices.add({
  var head = Lag.kr(In.kr(~bHead), 8);
  var wind = Lag.kr(In.kr(~bWind), 4);
  var waveH = Lag.kr(In.kr(~bWaveH), 4);
  var waveP = Lag.kr(In.kr(~bWaveP), 4);
  var temp = Lag.kr(In.kr(~bTemp), 8);
  var freq = 55 * (0.5 + (temp * 1.5));
  var cutoff = 300 + (wind * 3500);
  var pulse = 0.15 + ((head - 0.5).abs * 1.2);
  var bed = RLPF.ar(Saw.ar(freq + (SinOsc.kr(pulse) * 4)) * 0.08, cutoff, 0.3);
  var texture = BPF.ar(PinkNoise.ar(waveH * 0.2), 1200 + (waveH * 2000), 0.05 + (waveP * 0.4));
  (bed + texture).dup;
}.play);

OSCdef(\head, { |msg| ~bHead.set(msg[1]) }, '/bosphorus/sea/head');
OSCdef(\wind, { |msg| ~bWind.set(msg[1]) }, '/bosphorus/wind/speed');
OSCdef(\waveH, { |msg| ~bWaveH.set(msg[1]) }, '/bosphorus/wave/height');
OSCdef(\waveP, { |msg| ~bWaveP.set(msg[1]) }, '/bosphorus/wave/period');
OSCdef(\temp, { |msg| ~bTemp.set(msg[1]) }, '/bosphorus/sea/temp');
OSCdef(\gate, {
  {
    EnvGen.kr(Env.perc(0.001, 0.25), doneAction: 2) * PinkNoise.ar(0.3)
  }.play;
}, '/bosphorus/event/gate');

"placeholder patch loaded".postln;
