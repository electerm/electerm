; Prevent deleting shortcuts during silent uninstall (upgrades)
!macro deleteStartMenuShortcut
  IfSilent +2 ; Skip if uninstaller is running silently (during upgrade)
  Delete "$SMPROGRAMS\${PRODUCT_FILENAME}.lnk"
!macroend

!macro deleteDesktopShortcut
  IfSilent +2 ; Skip if silent
  Delete "$DESKTOP\${PRODUCT_FILENAME}.lnk"
!macroend