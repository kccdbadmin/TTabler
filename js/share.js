"use strict";
//==================================================================
// share.js — building & copying the shareable link. The heavy lifting
// (encoding state to base64) lives in storage.js; this is the UX around
// it. When you add a real backend later, this is where "create short
// link" would call out to it.
//   shareLink()
//==================================================================

function shareLink() {
  const url = location.origin + location.pathname + "#tt=" + encodeState();
  navigator.clipboard?.writeText(url).then(
    () => toast("🔗 Link copied — anyone who opens it sees this timetable"),
    () => { prompt("Copy this link:", url); }
  );
  history.replaceState(null, "", "#tt=" + encodeState());
  if (url.length > 30000) toast("⚠ Link is large — Export to a file is more reliable for big schools");
}
