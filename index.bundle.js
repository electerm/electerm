(function(r,n){typeof exports=="object"&&typeof module<"u"?n(require("react"),require("react-dom")):typeof define=="function"&&define.amd?define(["react","react-dom"],n):(r=typeof globalThis<"u"?globalThis:r||self,n(r.React,r.ReactDOM))})(this,function(r,n){"use strict";var c={exports:{}},i={};/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var l=r,_=Symbol.for("react.element"),y=Symbol.for("react.fragment"),R=Object.prototype.hasOwnProperty,v=l.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,x={key:!0,ref:!0,__self:!0,__source:!0};function u(o,e,a){var t,f={},s=null,m=null;a!==void 0&&(s=""+a),e.key!==void 0&&(s=""+e.key),e.ref!==void 0&&(m=e.ref);for(t in e)R.call(e,t)&&!x.hasOwnProperty(t)&&(f[t]=e[t]);if(o&&o.defaultProps)for(t in e=o.defaultProps,e)f[t]===void 0&&(f[t]=e[t]);return{$$typeof:_,type:o,key:s,ref:m,props:f,_owner:v.current}}i.Fragment=y,i.jsx=u,i.jsxs=u,c.exports=i;var E=c.exports,d,p=n;d=p.createRoot,p.hydrateRoot;function O(){function o(){console.log("inited")}return r.useEffect(()=>{o()},[]),null}const h="",j="";d(document.getElementById("container")).render(E.jsx(O,{}))});
