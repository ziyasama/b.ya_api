// HOT-RELOADABLE SLOT
// Replace this file with the composed patch, then send OSC
//   /bosphorus/patch/reload 1.0
// or restart the radio container. To restore the default:
//   cp radio/patch/placeholder.scd radio/patch/live.scd

this.executeFile(thisProcess.nowExecutingPath.dirname +/+ "placeholder.scd");
