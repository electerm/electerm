/**
 * zmodem functions
 */

//----------------------------------------------------------------------
// UI STUFF
/*
function _show_file_info(xfer) {
  var file_info = xfer.get_details();

  document.getElementById("name").textContent = file_info.name;
  document.getElementById("size").textContent = file_info.size;
  document.getElementById("mtime").textContent = file_info.mtime;
  document.getElementById("files_remaining").textContent = file_info.files_remaining;
  document.getElementById("bytes_remaining").textContent = file_info.bytes_remaining;

  document.getElementById("mode").textContent = "0" + file_info.mode.toString(8);

  var xfer_opts = xfer.get_options();
  ["conversion", "management", "transport", "sparse"].forEach((lbl) => {
    document.getElementById(`zfile_${lbl}`).textContent = xfer_opts[lbl];
  });

  document.getElementById("zm_file").style.display = "";
}

function _hide_file_info() {
  document.getElementById("zm_file").style.display = "none";
}

function _save_to_disk(xfer, buffer) {
  return Zmodem.Browser.save_to_disk(buffer, xfer.get_details().name);
}

var skipper_button = document.getElementById("zm_progress_skipper");
var skipper_button_orig_text = skipper_button.textContent;

function _show_progress() {
  skipper_button.disabled = false;
  skipper_button.textContent = skipper_button_orig_text;

  document.getElementById("bytes_received").textContent = 0;
  document.getElementById("percent_received").textContent = 0;

  document.getElementById("zm_progress").style.display = "";
}

function _update_progress(xfer) {
  var total_in = xfer.get_offset();

  document.getElementById("bytes_received").textContent = total_in;

  var percent_received = 100 * total_in / xfer.get_details().size;
  document.getElementById("percent_received").textContent = percent_received.toFixed(2);
}

function _hide_progress() {
  document.getElementById("zm_progress").style.display = "none";
}

var start_form = document.getElementById("zm_start");

function _auto_zmodem() {
  return document.getElementById("zmodem-auto").checked;
}

function _handle_receive_session(zsession) {
  zsession.on("offer", function (xfer) {
    current_receive_xfer = xfer;

    _show_file_info(xfer);

    var offer_form = document.getElementById("zm_offer");

    function on_form_submit() {
      offer_form.style.display = "none";

      //START
      //if (offer_form.zmaccept.value) {
      if (_auto_zmodem() || document.getElementById("zmaccept_yes").checked) {
        _show_progress();

        var FILE_BUFFER = [];
        xfer.on("input", (payload) => {
          _update_progress(xfer);
          FILE_BUFFER.push(new Uint8Array(payload));
        });
        xfer.accept().then(
          () => {
            _save_to_disk(xfer, FILE_BUFFER);
          },
          console.error.bind(console)
        );
      } else {
        xfer.skip();
      }
      //END
    }

    if (_auto_zmodem()) {
      on_form_submit();
    } else {
      offer_form.onsubmit = on_form_submit;
      offer_form.style.display = "";
    }
  });

  var promise = new Promise((res) => {
    zsession.on("session_end", () => {
      _hide_file_info();
      _hide_progress();
      res();
    });
  });

  zsession.start();

  return promise;
}

function _handle_send_session(zsession) {
  var choose_form = document.getElementById("zm_choose");
  choose_form.style.display = "";

  var file_el = document.getElementById("zm_files");

  var promise = new Promise((res) => {
    file_el.onchange = function (e) {
      choose_form.style.display = "none";

      var files_obj = file_el.files;

      Zmodem.Browser.send_files(
        zsession,
        files_obj, {
          on_offer_response(obj, xfer) {
            if (xfer) _show_progress();
            //console.log("offer", xfer ? "accepted" : "skipped");
          },
          on_progress(obj, xfer) {
            _update_progress(xfer);
          },
          on_file_complete(obj) {
            //console.log("COMPLETE", obj);
            _hide_progress();
          },
        }
      ).then(_hide_progress).then(
        zsession.close.bind(zsession),
        console.error.bind(console)
      ).then(() => {
        _hide_file_info();
        _hide_progress();
        res();
      });
    };
  });

  return promise;
}

/*
<!doctype html>
<html>
    <head>
        <title>xterm.js demo</title>
        <link rel="stylesheet" href="/build/xterm.css" />
        <link rel="stylesheet" href="/build/addons/fullscreen/fullscreen.css" />
        <link rel="stylesheet" href="/demo/style.css" />
      	<script src="https://cdnjs.cloudflare.com/ajax/libs/es6-promise/4.1.1/es6-promise.auto.min.js"></script>
      	<script src="https://cdnjs.cloudflare.com/ajax/libs/fetch/1.0.0/fetch.min.js"></script>
        <script src="/build/xterm.js" ></script>

        <script src="/build/addons/attach/attach.js" ></script>
        <script src="/zmodemjs/zmodem.js"></script>
        <script src="/build/addons/zmodem/zmodem.js" ></script>

        <script src="/build/addons/fit/fit.js" ></script>
        <script src="/build/addons/fullscreen/fullscreen.js" ></script>
        <script src="/build/addons/search/search.js" ></script>
    </head>
    <body>
        <h1>xterm.js: xterm, in the browser</h1>

        <div id="terminal-container"></div>

        <div id="zmodem_controls">
            <form id="zm_start" style="display: none" action="javascript:void(0)">
                ZMODEM detected: Start ZMODEM session?
                <label><input id="zmstart_yes" name="zmstart" type=radio checked value="1"> Yes</label>
                &nbsp;
                <label><input name="zmstart" type=radio value=""> No</label>
                <button type="submit">Submit</button>
            </form>

            <form id="zm_offer" style="display: none" action="javascript:void(0)">
                <p>ZMODEM File offered!</p>

                <label><input id="zmaccept_yes" name="zmaccept" type=radio checked value="1"> Accept</label>
                &nbsp;
                <label><input name="zmaccept" type=radio value=""> Skip</label>
                <button type="submit">Submit</button>
            </form>

            <div id="zm_file" style="display: none">
                <div>Name: <span id="name"></span></div>
                <div>Size: <span id="size"></span></div>
                <div>Last modified: <span id="mtime"></span></div>
                <div>Mode: <span id="mode"></span></div>
                <br>
                <div>Conversion: <span id="zfile_conversion"></span></div>
                <div>Management: <span id="zfile_management"></span></div>
                <div>Transport: <span id="zfile_transport"></span></div>
                <div>Sparse? <span id="zfile_sparse"></span></div>
                <br>
                <div>Files remaining in batch: <span id="files_remaining"></span></div>
                <div>Bytes remaining in batch: <span id="bytes_remaining"></span></div>
            </div>

            <form id="zm_progress" style="display: none" action="javascript:void(0)">
                <div><span id="percent_received"></span>% (<span id="bytes_received"></span> bytes) received</div>
                <button id="zm_progress_skipper" type="button" onclick="skip_current_file();">Skip File</button>
            </form>

            <form id="zm_choose" style="display: none" action="javascript:void(0)">
                <label>Choose file(s): <input id="zm_files" type="file" multiple></label>
            </form>
        </div>

        <div>
          <h2>Actions</h2>
          <p>
            <label>Find next <input id="find-next"/></label>
            <label>Find previous <input id="find-previous"/></label>
          </p>
        </div>
        <div>
          <h2>Options</h2>
          <p>
            <label><input type="checkbox" id="option-cursor-blink"> cursorBlink</label>
          </p>
          <p>
            <label><input type="checkbox" checked id="zmodem-auto"> Accept all ZMODEM prompts<sup>*</sup></label>
          </p>
          <p>
            <label>
              cursorStyle
              <select id="option-cursor-style">
                <option value="block">block</option>
                <option value="underline">underline</option>
                <option value="bar">bar</option>
              </select>
            </label>
          </p>
          <p>
            <label>
              bellStyle
              <select id="option-bell-style">
                <option value="">none</option>
                <option value="sound">sound</option>
                <option value="visual">visual</option>
                <option value="both">both</option>
              </select>
            </label>
          </p>
          <p>
            <label>scrollback <input type="number" id="option-scrollback" value="1000" /></label>
          </p>
          <p>
            <label>tabStopWidth <input type="number" id="option-tabstopwidth" value="8" /></label>
          </p>
          <div>
          	<h3>Size</h3>
            <div>
              <div style="display: inline-block; margin-right: 16px;">
                <label for="cols">Columns</label>
                <input type="number" id="cols" />
              </div>
              <div style="display: inline-block; margin-right: 16px;">
                <label for="rows">Rows</label>
                <input type="number" id="rows" />
              </div>
            </div>
          </div>
        </div>
        <p><strong>Attention:</strong> The demo is a barebones implementation and is designed for xterm.js evaluation purposes only. Exposing the demo to the public as is would introduce security risks for the host.</p>
        <p><sup>*</sup> ZMODEM file transfers are supported via an addon. To try it out, install <a href="https://ohse.de/uwe/software/lrzsz.html"><code>lrzsz</code></a> onto the remote peer, then run <code>rz</code> to send from your browser or <code>sz &lt;file&gt;</code> to send from the remote peer.</p>
        <script src="main.js" defer ></script>
    </body>
</html>
*/
