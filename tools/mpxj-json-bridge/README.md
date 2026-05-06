# MPXJ JSON bridge

LGPL-licensed [MPXJ](https://www.mpxj.org/) wraps readers for binary Microsoft Project files where pure Node parsers do not exist.

## Build

```bash
cd tools/mpxj-json-bridge
mvn -q package
```

Shaded JAR output: `target/mpxj-json-bridge.jar`

## Configure QEGPMO backend

Set environment variables:

- `MPXJ_BRIDGE_JAR` — absolute path to `mpxj-json-bridge.jar`
- `JAVA_BIN` — optional, defaults to `java`

## Limitations

- MPXJ **reads** `.mpp` (and many other formats) but **does not write** binary `.mpp`. QEGPMO exports **MSPDI XML**, which Microsoft Project opens directly.
- Resource assignments, enterprise calendars, and cost dimensions are reported under `unsupportedFields` and are not imported.
