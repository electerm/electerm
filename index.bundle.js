(function(r,n){typeof exports=="object"&&typeof module<"u"?n(require("react"),require("react-dom"),require("universe-bg")):typeof define=="function"&&define.amd?define(["react","react-dom","universe-bg"],n):(r=typeof globalThis<"u"?globalThis:r||self,n(r.React,r.ReactDOM))})(this,function(r,n){"use strict";var u={exports:{}},i={};/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var l=r,_=Symbol.for("react.element"),y=Symbol.for("react.fragment"),v=Object.prototype.hasOwnProperty,R=l.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,x={key:!0,ref:!0,__self:!0,__source:!0};function c(o,e,a){var t,s={},f=null,m=null;a!==void 0&&(f=""+a),e.key!==void 0&&(f=""+e.key),e.ref!==void 0&&(m=e.ref);for(t in e)v.call(e,t)&&!x.hasOwnProperty(t)&&(s[t]=e[t]);if(o&&o.defaultProps)for(t in e=o.defaultProps,e)s[t]===void 0&&(s[t]=e[t]);return{$$typeof:_,type:o,key:f,ref:m,props:s,_owner:R.current}}i.Fragment=y,i.jsx=c,i.jsxs=c,u.exports=i;var E=u.exports,d,p=n;d=p.createRoot,p.hydrateRoot;function O(){function o(){console.log("inited")}return r.useEffect(()=>{o()},[]),null}const h="",b="";d(document.getElementById("container")).render(E.jsx(O,{}))});
