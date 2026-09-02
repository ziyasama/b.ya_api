/**
 * SuperCollider language boot. Opens the UDP port the Node broadcaster
 * already uses (57121) and loads the hot-reloadable patch slot.
 *
 * Replace radio/patch/live.scd and send /bosphorus/patch/reload 1.0, or
 * restart the container. placeholder.scd is the default; copy it back over
 * live.scd to reset.
 */
s.options.numOutputBusChannels = 2;
s.options.memSize = 32 * 1024;
s.waitForBoot({
  var dir = thisProcess.nowExecutingPath.dirname;
  thisProcess.openUDPPort(57121);
  ~patchDir = dir;
  ~loadLive = {
    var path = ~patchDir +/+ "live.scd";
    ("loading patch " ++ path).postln;
    this.executeFile(path);
  };
  OSCdef(\patchReload, { ~loadLive.value; }, '/bosphorus/patch/reload');
  ~loadLive.value;
  "bosphorus patch slot ready".postln;
});
