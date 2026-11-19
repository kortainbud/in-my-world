Kokoro TTS web build (kokoro-js 1.2.1, Apache-2.0), copied from the npm package
`kokoro-js/dist/kokoro.web.js`. It is served as a static file and loaded on demand by
src/lib/client/kokoro.ts. The npm package itself is NOT a dependency: it pulls in
onnxruntime-node, whose Linux install script fails on Netlify. To update, install
kokoro-js somewhere temporary and copy the new web build here.
