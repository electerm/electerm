; context-menu.nsh
; Custom NSIS include for electerm installer.
;
; Adds a checkbox on the Finish page that lets the user register
; "Open in electerm" in Windows Explorer's right-click context menu for folders.
; Also cleans up registry keys on uninstall.
;
; Registry keys are written under HKCU so no elevation is required.

; ---------------------------------------------------------------------------
; Finish-page customisation — replaces the default !insertmacro MUI_PAGE_FINISH
; block from assistedInstaller.nsh.
; ---------------------------------------------------------------------------
!macro customFinishPage
  ; Re-define the "launch app" function that the stock template would have
  ; defined inside its !else branch (we must provide it when we take over the
  ; finish page).
  Function StartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  !ifndef HIDE_RUN_AFTER_FINISH
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !endif

  ; Checkbox: "Add 'Open in electerm' to Windows Explorer context menu"
  ; The SHOWREADME feature of MUI2 is repurposed here as an extra action.
  !define MUI_FINISHPAGE_SHOWREADME ""
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Add 'Open in electerm' to Windows Explorer context menu"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION "RegisterElectermContextMenu"

  !insertmacro MUI_PAGE_FINISH
!macroend

; ---------------------------------------------------------------------------
; Function called when the finish-page checkbox is checked.
; ---------------------------------------------------------------------------
Function RegisterElectermContextMenu
  ; Check if already registered to avoid duplicate writes
  ReadRegStr $R0 HKCU "Software\Classes\Directory\shell\electerm" ""
  StrCmp $R0 "" 0 done

  ; Folder icon right-click
  WriteRegStr HKCU "Software\Classes\Directory\shell\electerm" \
    "" "Open in electerm"
  WriteRegStr HKCU "Software\Classes\Directory\shell\electerm" \
    "Icon" "$appExe"
  WriteRegStr HKCU "Software\Classes\Directory\shell\electerm\command" \
    "" '"$appExe" -tp "local" -d "%1"'

  ; Folder background right-click (right-click inside a folder)
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\electerm" \
    "" "Open in electerm"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\electerm" \
    "Icon" "$appExe"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\electerm\command" \
    "" '"$appExe" -tp "local" -d "%V"'

  done:
FunctionEnd

; ---------------------------------------------------------------------------
; Cleanup on uninstall — remove context menu registry keys if present.
; ---------------------------------------------------------------------------
!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\Directory\shell\electerm"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\electerm"
!macroend
