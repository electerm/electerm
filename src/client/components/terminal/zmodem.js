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
*/
