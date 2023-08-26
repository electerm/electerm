(function(r,n){typeof exports=="object"&&typeof module<"u"?n(require("react"),require("react-dom"),require("universe-bg")):typeof define=="function"&&define.amd?define(["react","react-dom","universe-bg"],n):(r=typeof globalThis<"u"?globalThis:r||self,n(r.React,r.ReactDOM,r.UniverseBg))})(this,function(r,n,l){"use strict";var u={exports:{}},i={};/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var _=r,y=Symbol.for("react.element"),v=Symbol.for("react.fragment"),R=Object.prototype.hasOwnProperty,x=_.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,h={key:!0,ref:!0,__self:!0,__source:!0};function c(o,e,m){var t,s={},f=null,p=null;m!==void 0&&(f=""+m),e.key!==void 0&&(f=""+e.key),e.ref!==void 0&&(p=e.ref);for(t in e)R.call(e,t)&&!h.hasOwnProperty(t)&&(s[t]=e[t]);if(o&&o.defaultProps)for(t in e=o.defaultProps,e)s[t]===void 0&&(s[t]=e[t]);return{$$typeof:y,type:o,key:f,ref:p,props:s,_owner:x.current}}i.Fragment=v,i.jsx=c,i.jsxs=c,u.exports=i;var E=u.exports,a,d=n;a=d.createRoot,d.hydrateRoot;function O(){function o(){window.x=new l({className:"animate",shootingStarSize:.4,shootingStarColor:6710886,starColor:6710886,bgColor:16777215})}return r.useEffect(()=>{o()},[]),null}const S="",b="";a(document.getElementById("container")).render(E.jsx(O,{}))});
