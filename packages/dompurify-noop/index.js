// No-op DOMPurify replacement
// This project does not use DOMPurify directly.
// jspdf lists it as an optional dependency but does not require it for our use case.
// All versions of dompurify 3.x have known XSS advisories, so we replace it with this empty stub.

const sanitize = (dirty) => dirty;
sanitize.sanitize = sanitize;
sanitize.addHook = () => {};
sanitize.removeHook = () => {};
sanitize.removeHooks = () => {};
sanitize.removeAllHooks = () => {};
sanitize.isSupported = false;
sanitize.version = '0.0.0-noop';
sanitize.setConfig = () => {};
sanitize.clearConfig = () => {};

module.exports = sanitize;
module.exports.default = sanitize;
