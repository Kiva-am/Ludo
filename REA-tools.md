# REA tool inventory

Verified live MCP server: rea-agents 6.5.0.

Advertised tools: 207. Tools marked available may still require an explicit target, endpoint, runtime permission, or saved evidence as input.

## official-proxy — Conditional / unavailable

- `address_name`
- `address_to_file_offset`
- `comment`
- `current_address`
- `current_document`
- `current_procedure`
- `inline_comment`
- `inspect_native_data_type`
- `inspect_native_instruction`
- `inspect_native_load_image`
- `list_bookmarks`
- `list_documents`
- `list_names`
- `list_procedures`
- `list_segments`
- `list_strings`
- `next_address`
- `prev_address`
- `procedure_address`
- `procedure_assembly`
- `procedure_callees`
- `procedure_callers`
- `procedure_info`
- `procedure_pseudo_code`
- `procedure_references`
- `read_bytes`
- `read_function_instructions`
- `resolve_containing_procedure`
- `resolve_native_call_targets`
- `search_bytes`
- `search_procedures`
- `search_strings`
- `xrefs`

Reason: target_required. Call open_binary with a supported local target.

## enhanced — Conditional / unavailable

- `analyze_function`
- `analyze_swift_types`
- `batch_decompile`
- `binary_overview`
- `find_xrefs_to_name`
- `get_call_graph`
- `get_objc_classes`
- `get_objc_protocols`
- `inspect_native_dispatch_metadata`
- `trace_native_ui_action`
- `trace_native_values`

Reason: target_required. Call open_binary with a supported local target.

## electron-provider — Available

- `analyze_javascript_application`
- `reconcile_javascript_runtime`

## browser-provider — Available

- `analyze_web_bundle`
- `capture_web_screenshot`
- `discover_webmcp_tools`
- `inspect_web_event_listeners`
- `inspect_web_page`
- `list_browser_targets`
- `observe_web_session`

## official-proxy — Conditional / unavailable

- `annotate_native_function`

Reason: target_required. Call open_binary with a supported local target.

## session — Available

- `binary_session`

## session — Available

- `build_call_path`
- `compare_artifacts`
- `compare_bundles`
- `compare_functions`
- `compare_process_captures`
- `correlate_static_and_runtime`
- `find_changed_behavior`
- `import_evidence_bundle`
- `inspect_address_context`
- `verify_reconstruction`

## application — Available

- `build_reconstruction_obligation_ledger`
- `compare_application_versions`
- `compare_javascript_export_shapes`
- `compare_managed_members`
- `compare_source_to_bundle`
- `compare_wasm_interfaces`
- `import_managed_reconstruction`
- `inspect_analysis_view`
- `project_android_application_graph`
- `project_apple_application_graph`
- `project_harmony_application_graph`
- `project_managed_application_graph`
- `trace_application_feature`
- `trace_javascript_semantics`
- `verify_managed_native_boundaries`

## adb-provider — Conditional / unavailable

- `capture_adb_screen`
- `collect_adb_bugreport`
- `pull_adb_file`
- `pull_adb_package`

Reason: provider_unavailable. The selected adb binary was not found: adb

## browser-provider — Available

- `capture_browser_scenario`

## electron-provider — Available

- `capture_electron_scenario`

## native-provider — Conditional / unavailable

- `capture_native_ui_scenario`

Reason: unsupported_host. Native macOS utilities require macOS.

## session — Conditional / unavailable

- `capture_process_scenario`

Reason: unsupported_host. Run process capture on a supported Linux or macOS host.

## session — Available

- `close_binary`

## native-provider — Available

- `close_frida_session`
- `start_frida_session`
- `unload_frida_script`

## native-provider — Conditional / unavailable

- `close_gdb_session`
- `start_rizin_debug_session`

Reason: target_required. Call open_binary with a supported local target.

## native-provider — Conditional / unavailable

- `close_rizin_debug_session`

Reason: target_required. Call open_binary with a supported local target.

## browser-provider — Available

- `compare_web_captures`
- `compare_web_screenshots`

## native-provider — Conditional / unavailable

- `cutter_command`

Reason: target_required. Call open_binary with a supported local target.

## apktool-provider — Conditional / unavailable

- `decode_android_resources`

Reason: provider_unavailable. The apktool launcher was not found on the selected Windows PATH/PATHEXT

## artifact-provider — Conditional / unavailable

- `decode_interface_builder`
- `inspect_keyed_archive`
- `trace_dylib_resolution`

Reason: target_required. Call open_binary with a supported local target.

## artifact-provider — Conditional / unavailable

- `decode_signal_recording`
- `inspect_signal_decoders`

Reason: provider_missing. On Linux, supply sigrok-cli 0.7.2 via absolute REA_SIGROK_COMMAND and util-linux prlimit (REA_SIGROK_PRLIMIT_COMMAND, default /usr/bin/prlimit). No active binary target or hardware is required; the tool is checked at execution.

## jeb-provider — Conditional / unavailable

- `decompile_jeb_item`
- `inspect_jeb_client`
- `list_jeb_units`

Reason: provider_missing. Start a JEB client serving MCP (GUI client, or headless via its programmatic launcher) and point REA_JEB_MCP_URL at it (default http://127.0.0.1:8425/mcp). REA does not install or launch JEB.

## native-provider — Conditional / unavailable

- `demangle_swift`
- `inspect_macho`
- `inspect_plist`
- `inspect_signature`
- `list_architectures`

Reason: unsupported_host. Native macOS utilities require macOS.

## application — Available

- `evaluate_reconstruction_coverage`

## native-provider — Conditional / unavailable

- `execute_rizin_command`

Reason: target_required. Call open_binary with a supported local target.

## session — Available

- `export_evidence_bundle`

## application — Available

- `export_web_scripts`

## artifact-provider — Conditional / unavailable

- `extract_artifact`

Reason: target_required. Call open_binary with a supported local target.

## firmware-provider — Conditional / unavailable

- `extract_firmware`

Reason: provider_missing. On Linux, provide an absolute REA_BINWALK_COMMAND (Binwalk 3.1.x, verified with 3.1.0) or REA_UNBLOB_COMMAND (Unblob 26.6.x, verified with 26.6.4) path and util-linux prlimit. Extraction also requires the selected format’s external extractor.

## native-provider — Available

- `frida_session_status`

## native-provider — Conditional / unavailable

- `gdb_console`

Reason: target_required. Call open_binary with a supported local target.

## native-provider — Conditional / unavailable

- `gdb_session_status`

Reason: target_required. Call open_binary with a supported local target.

## session — Available

- `get_evidence_bundle`
- `list_unknowns`
- `verify_unknown_resolution`

## session — Conditional / unavailable

- `get_navigation_context`

Reason: provider_missing. Configure a provider for one of: current_document, current_address, resolve_containing_procedure.

## official-proxy — Conditional / unavailable

- `goto_address`

Reason: target_required. Call open_binary with a supported local target.

## flutter-provider — Available

- `identify_flutter_build`
- `inspect_dart_aot`

## adb-provider — Conditional / unavailable

- `inspect_adb_client`

Reason: provider_unavailable. The selected adb binary was not found: adb

## adb-provider — Conditional / unavailable

- `inspect_adb_device`
- `inspect_adb_display`
- `inspect_adb_package`
- `inspect_adb_window`
- `list_adb_devices`
- `list_adb_directory`
- `list_adb_features`
- `list_adb_packages`
- `list_adb_processes`
- `list_adb_services`
- `read_adb_logcat`
- `read_adb_setting`
- `resolve_adb_packages`

Reason: provider_unavailable. The selected adb binary was not found: adb

## android-provider — Conditional / unavailable

- `inspect_android_class`
- `inspect_android_method`
- `inspect_android_package`
- `search_android_classes`
- `trace_android_references`

Reason: provider_missing. Set REA_JADX_MCP_JAR to the absolute path of a caller-supplied jadx-headless-mcp 0.7.1 JAR. REA does not download or install it.

## apktool-provider — Conditional / unavailable

- `inspect_apktool_client`

Reason: provider_unavailable. The apktool launcher was not found on the selected Windows PATH/PATHEXT

## artifact-provider — Conditional / unavailable

- `inspect_artifact`

Reason: target_required. Call open_binary with a supported local target.

## artifact-provider — Conditional / unavailable

- `inspect_asset_catalog`

Reason: unsupported_host. Apple asset catalogs require macOS assetutil.

## native-provider — Conditional / unavailable

- `inspect_binary_layout`
- `inspect_recorded_crash`

Reason: provider_missing. On Linux x64, set absolute REA_PWNTOOLS_PYTHON to caller-supplied Python with pwntools 4.15.0. No active binary target is required.

## artifact-provider — Available

- `inspect_electron_fuses`
- `inspect_go_binary`
- `inspect_rust_binary`

## electron-provider — Available

- `inspect_electron_page`
- `list_electron_targets`

## artifact-provider — Conditional / unavailable

- `inspect_evm_interface`

Reason: provider_missing. The bundled offline EVM interface profile is currently real-verified on Linux x64. No active binary target or chain endpoint is required.

## firmware-provider — Conditional / unavailable

- `inspect_firmware_regions`

Reason: provider_missing. On Linux, provide an absolute REA_BINWALK_COMMAND (Binwalk 3.1.x, verified with 3.1.0) or REA_UNBLOB_COMMAND (Unblob 26.6.x, verified with 26.6.4) path and util-linux prlimit. Extraction also requires the selected format’s external extractor.

## managed-provider — Available

- `inspect_managed_artifact`
- `inspect_managed_members`
- `inspect_managed_native_boundaries`

## enhanced — Conditional / unavailable

- `inspect_native_api`
- `trace_call_path`
- `trace_feature`

Reason: target_required. Call open_binary with a supported local target.

## artifact-provider — Conditional / unavailable

- `inspect_packet_capture`
- `inspect_packet_fields`

Reason: provider_missing. On Linux, supply TShark 4.x via absolute REA_TSHARK_COMMAND and util-linux prlimit (REA_TSHARK_PRLIMIT_COMMAND, default /usr/bin/prlimit). No active binary target or hardware is required; the tool is checked at execution.

## pcap-provider — Available

- `inspect_pcap_capture`
- `inspect_pcap_client`

## native-provider — Available

- `inspect_pe_resources`

## artifact-provider — Conditional / unavailable

- `inspect_sqlite_database`

Reason: provider_unavailable. SQLite inspection requires Node.js 24.x >=24.15 or 26+ with the native DatabaseSync.limits API. Other REA features retain their published runtime requirements. The inspection worker verifies the API before querying the snapshot.

## artifact-provider — Conditional / unavailable

- `inspect_wasm_artifact`

Reason: provider_missing. Supply WABT 1.0.42 via absolute REA_WABT_BIN_DIRECTORY. No active binary target is required; tools are checked at execution.

## browser-provider — Available

- `inspect_web_network_capture`

## native-provider — Conditional / unavailable

- `inspect_with_objdump`

Reason: target_required. Call open_binary with a supported local target.

## adb-provider — Conditional / unavailable

- `install_adb_package`
- `start_adb_activity`
- `start_adb_app`
- `stop_adb_app`
- `uninstall_adb_package`

Reason: provider_unavailable. The selected adb binary was not found: adb

## native-provider — Available

- `instrument_with_frida`
- `load_frida_script`
- `resume_frida_session`

## native-provider — Conditional / unavailable

- `list_cutter_sessions`

Reason: target_required. Call open_binary with a supported local target.

## native-provider — Available

- `list_frida_devices`
- `list_frida_processes`

## runtime-provider — Available

- `list_javascript_runtime_targets`
- `observe_javascript_runtime`

## native-provider — Conditional / unavailable

- `observe_native_calls`

Reason: unsupported_host. Native macOS utilities require macOS.

## native-provider — Conditional / unavailable

- `observe_native_ui`

Reason: unsupported_host. Native macOS utilities require macOS.

## browser-provider — Available

- `observe_web_execution`

## session — Available

- `open_binary`

## jeb-provider — Conditional / unavailable

- `open_jeb_project`

Reason: provider_missing. Start a JEB client serving MCP (GUI client, or headless via its programmatic launcher) and point REA_JEB_MCP_URL at it (default http://127.0.0.1:8425/mcp). REA does not install or launch JEB.

## adb-provider — Conditional / unavailable

- `push_adb_file`

Reason: provider_unavailable. The selected adb binary was not found: adb

## session — Available

- `record_unknown`
- `update_unknown`

## application — Conditional / unavailable

- `recover_javascript_sources`

Reason: provider_missing. On Linux x64, provide an absolute REA_WAKARU_COMMAND for Wakaru ^1.13.0 (verified with 1.14.0) and util-linux prlimit; see docs/javascript-recovery.md#install-wakaru. No binary target is required.

## native-provider — Conditional / unavailable

- `rizin_debug_command`

Reason: target_required. Call open_binary with a supported local target.

## native-provider — Conditional / unavailable

- `rizin_debug_session_status`

Reason: target_required. Call open_binary with a supported local target.

## official-proxy — Conditional / unavailable

- `set_address_name`
- `set_addresses_names`
- `set_bookmark`
- `set_comment`
- `set_inline_comment`
- `unset_bookmark`

Reason: target_required. Call open_binary with a supported local target.

## native-provider — Conditional / unavailable

- `start_gdb_session`

Reason: target_required. Call open_binary with a supported local target.

## application — Available

- `trace_web_module_imports`

## application — Available

- `trace_web_source_location`


