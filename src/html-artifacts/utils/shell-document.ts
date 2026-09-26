/**
 * 沙箱 iframe 的文档构造：两种形态——内容已经齐了的静态文档，和内容随后经消息桥送进去的外壳文档。
 * 两种形态共用同一份桥接脚本、同一个尺寸控制器和同一套渲染运行时，因此宿主两边看到的行为完全一致。
 * 注入脚本里的每个缺省数字都从常量表插进来，不在这里另抄一份。
 */
import {
  HtmlArtifactBridgeMessageTypes,
  HtmlArtifactDefaults,
} from '../contract/constants.js'
import type {
  HtmlArtifactBridgeMessages,
  HtmlArtifactContentKind,
  HtmlArtifactDocumentOptions,
  HtmlArtifactShellDocumentOptions,
} from '../types/html-artifacts.js'

import { isFinitePositiveNumber } from './runtime-guards.js'
import { HTML_ARTIFACT_SIZE_CONTROLLER_FACTORY_SOURCE } from './size-controller.js'
import { HtmlArtifactTuning } from './tuning.js'

// 模型输出常用 `CDATA` 或 Markdown 代码围栏包裹内容，但解析 HTML 时 `CDATA` 并非透明包装。
// 渲染前只归一化包住完整源码的外层包装；局部流式内容可以合理地暂缺闭合包装。
const SOURCE_FENCE_OPEN_PATTERN = /^```[\w-]*[ \t]*\r?\n/
const SOURCE_FENCE_CLOSE_PATTERN = /\r?\n```[ \t]*$/
const SOURCE_CDATA_OPEN = '<![CDATA['
const SOURCE_CDATA_CLOSE = ']]>'

// 制品 iframe 在上限内按内容自适应；超过 maxReportedHeight 或遇到 viewport 反馈时保留
// 内部滚动。滚动条本身隐藏(不裁剪、仍可滚)，让沙箱和宿主视觉连续。
const HIDE_IFRAME_SCROLLBAR_CSS =
  'html,body{scrollbar-width:none;}html::-webkit-scrollbar,body::-webkit-scrollbar{width:0;height:0;display:none;}'

/** 剥掉一层包住完整源码的外层包装（CDATA 或 Markdown 代码围栏）；没有包装就原样返回。 */
function stripOuterSourceWrapper(content: string): string {
  const trimmed = content.trim()

  if (trimmed.startsWith(SOURCE_CDATA_OPEN)) {
    let inner = trimmed.slice(SOURCE_CDATA_OPEN.length)
    if (inner.trimEnd().endsWith(SOURCE_CDATA_CLOSE)) {
      inner = inner.slice(0, inner.lastIndexOf(SOURCE_CDATA_CLOSE))
    }
    return inner.trim()
  }

  const fenceOpen = SOURCE_FENCE_OPEN_PATTERN.exec(trimmed)
  if (fenceOpen) {
    let inner = trimmed.slice(fenceOpen[0].length)
    const fenceClose = SOURCE_FENCE_CLOSE_PATTERN.exec(inner)
    if (fenceClose) {
      inner = inner.slice(0, fenceClose.index)
    }
    return inner.trim()
  }

  return content
}

/** 反复剥掉外层包装，直到剥不动或者用完预算。 */
export function normalizeHtmlArtifactSource(content: string): string {
  let current = content
  for (let pass = 0; pass < HtmlArtifactTuning.sourceUnwrapPasses; pass += 1) {
    const next = stripOuterSourceWrapper(current)
    if (next === current) return current
    current = next
  }
  return current
}

/** 判断一段源码是普通 HTML 还是一整张 SVG。 */
export function inferHtmlArtifactContentKind(content: string): HtmlArtifactContentKind {
  return /^<svg[\s>]/i.test(normalizeHtmlArtifactSource(content).trimStart()) ? 'svg' : 'html'
}

/** 把宿主给的桥接消息名补成完整的一套，没给的那几个用常量表里的缺省。 */
function resolveBridgeMessages(
  messages: HtmlArtifactDocumentOptions['bridgeMessages']
): HtmlArtifactBridgeMessages {
  return { ...HtmlArtifactBridgeMessageTypes.defaults, ...messages }
}

/** 取这一份文档的高度硬上限；宿主没给正数就用常量表里的缺省。 */
function resolveMaxReportedHeight(value: HtmlArtifactDocumentOptions['maxReportedHeight']): number {
  return isFinitePositiveNumber(value)
    ? Math.max(1, Math.ceil(value))
    : HtmlArtifactDefaults.maxReportedHeight
}

/** 取这一份文档的宽度倍数上限；宿主没给正数就用常量表里的缺省。 */
function resolveMaxWidthRatio(value: HtmlArtifactDocumentOptions['maxWidthRatio']): number {
  return isFinitePositiveNumber(value) ? value : HtmlArtifactDefaults.maxWidthRatio
}

/** 取 body 的内联样式；宿主没给就按内容类型给一份缺省。 */
function resolveBodyStyle(
  kind: HtmlArtifactContentKind,
  bodyStyle: HtmlArtifactDocumentOptions['bodyStyle']
): string {
  if (bodyStyle) return bodyStyle

  return kind === 'svg'
    ? 'margin:0;width:100%;min-height:100%;background:transparent;'
    : 'margin:0;background:transparent;'
}

/** 转义要写进 HTML 属性里的文本。 */
function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/** 把一段文本变成可以直接嵌进内联脚本的 JS 字符串字面量。 */
function jsString(value: string): string {
  return JSON.stringify(value)
}

/** 装在 `<head>` 里的桥接脚本：错误上报、`sendPrompt` / `openLink` / `artifactBridge`，以及滚轮转发。 */
function bridgeHeadScript(messages: HtmlArtifactBridgeMessages): string {
  return (
    `window.__htmlArtifactReportRuntimeError=function(error,meta){`
    + `try{`
    + `var payload={type:${jsString(messages.error)},message:String(error&&error.message||error&&error.reason||error||'制品脚本执行出错')};`
    + `if(meta&&meta.phase)payload.phase=String(meta.phase);`
    + `if(meta&&meta.patchType)payload.patchType=String(meta.patchType);`
    + `if(meta&&meta.patchId)payload.patchId=String(meta.patchId);`
    + `window.parent.postMessage(payload,'*');`
    + `}catch(ignore){}`
    + `};`
    + `window.sendPrompt=function(text){window.parent.postMessage({type:${jsString(messages.sendPrompt)},prompt:String(text||'')},'*')};`
    + `window.openLink=function(url){window.parent.postMessage({type:${jsString(messages.openLink)},url:String(url||'')},'*')};`
    + `window.artifactBridge={send:function(payload){window.parent.postMessage({type:${jsString(messages.generic)},payload:payload},'*')}};`
    // 普通脚本的顶层 let / const / class 跟 window 上改不掉的名字同名（top、location、document、window），或者跟前面
    // 一段脚本重名，整段在实例化时就失败，一行都没跑。套一层块再跑一次：顶层声明只在这段脚本里，var 与函数照旧挂到全局；
    // 这次的错不上报，再跑还失败才报。只认实例化阶段的重名错，脚本跑到一半抛出的 SyntaxError（JSON.parse 之类）不重跑。
    + `window.addEventListener('error',function(event){`
    + `var script=document.currentScript;var error=event&&event.error;`
    + `if(!script||!script.parentNode||script.src||script.hasAttribute('data-velaros-script-retry'))return;`
    + `if(!error||error.name!=='SyntaxError'||!/already been declared|redeclaration of|duplicate variable|variable twice/i.test(String(error.message||'')))return;`
    + `var type=String(script.getAttribute('type')||'').trim().toLowerCase();`
    + `if(type&&type!=='text/javascript'&&type!=='application/javascript')return;`
    + `var retry=document.createElement('script');`
    + `Array.prototype.slice.call(script.attributes).forEach(function(attr){retry.setAttribute(attr.name,attr.value);});`
    + `retry.setAttribute('data-velaros-script-retry','true');`
    + `retry.__velarosScriptSource=script.__velarosScriptSource;`
    + `retry.text='{'+(script.text||'')+'\\n}';`
    + `event.preventDefault();event.stopImmediatePropagation();`
    + `script.parentNode.replaceChild(retry,script);`
    + `});`
    + `window.addEventListener('error',function(event){window.__htmlArtifactReportRuntimeError(event&&event.error||event&&event.message||'制品脚本执行出错',{phase:'window'});});`
    + `window.addEventListener('unhandledrejection',function(event){window.__htmlArtifactReportRuntimeError(event&&event.reason||'制品脚本里有 Promise 出错没人接',{phase:'script'});});`
    // 平铺后 iframe 根文档无可滚区域,wheel 事件却被 iframe 文档吞掉(跨文档不冒泡到宿主),
    // 鼠标悬停在制品上时聊天页会滚不动——把 wheel 转发给宿主代滚。先让制品自己的滚动容器接:
    // 鼠标下面有顺着这个方向还滚得动的容器(横向滚动的图表、可滚的表格),就照浏览器原样滚它;
    // 一路都滚不动才转发,转发时取消 iframe 里的默认滚动,免得制品和聊天页被同一次滚轮同时推动。
    + `function __htmlArtifactCanScroll(node,dx,dy){`
    + `var style=window.getComputedStyle;`
    + `if(typeof style!=='function')return false;`
    + `for(;node&&node.nodeType===1;node=node.parentElement){`
    + `var s=style(node);`
    + `if(dy&&/(auto|scroll|overlay)/.test(s.overflowY)&&node.scrollHeight>node.clientHeight+1&&(dy<0?node.scrollTop>0:node.scrollTop+node.clientHeight<node.scrollHeight-1))return true;`
    + `if(dx&&/(auto|scroll|overlay)/.test(s.overflowX)&&node.scrollWidth>node.clientWidth+1&&(dx<0?node.scrollLeft>0:node.scrollLeft+node.clientWidth<node.scrollWidth-1))return true;`
    + `}`
    + `return false;`
    + `}`
    + `window.addEventListener('wheel',function(event){`
    + `var doc=document.documentElement||{};`
    + `if(window.parent===window||(doc.scrollHeight||0)>(doc.clientHeight||0)+1||(doc.scrollWidth||0)>(doc.clientWidth||0)+1)return;`
    + `var dx=Number(event.deltaX)||0,dy=Number(event.deltaY)||0;`
    + `if(__htmlArtifactCanScroll(event.target,dx,dy))return;`
    + `if(event.cancelable!==false)event.preventDefault();`
    + `window.parent.postMessage({type:${jsString(HtmlArtifactBridgeMessageTypes.wheel)},deltaY:dy,deltaX:dx},'*');`
    + `},{capture:true,passive:false});`
  )
}

/**
 * 单一尺寸控制器(静态/live 两条测量路径共用,高与宽同轨):
 * - 只有真实的 DOM/样式变更会使旧测量失效;宿主按回传尺寸调整 iframe 不会重置状态。
 * - 高:溢出时记录 scrollHeight 地板,避免 scrollHeight 与子元素几何值互相拉扯;连续两轮随
 *   viewport 等量增长即判定为 100vh/百分比反馈并冻结;maxReportedHeight 是硬上限,超过后由
 *   iframe 内部滚动承接。
 * - 宽:回传宽会被宿主变成 iframe 宽 + 缩放比,所以「宽随视口长」同样是闭环——连续两轮随
 *   viewport 增长即冻结回宿主首个可用宽,maxWidthRatio 是硬上限。
 * - 回传在源头按 1px 容差去重,宿主只会收到唯一目标值,不会参与二次补偿。
 */
function sizeControllerScript(maxReportedHeight: number, maxWidthRatio: number): string {
  return (
    `var sizeController=(${HTML_ARTIFACT_SIZE_CONTROLLER_FACTORY_SOURCE})(${maxReportedHeight},${maxWidthRatio});`
    + `function invalidateHeightMeasurement(){sizeController.invalidate();}`
    + `function resolveReportedHeight(base){`
    + `var doc=document.documentElement||{};`
    + `return sizeController.resolve({baseHeight:base,clientHeight:doc.clientHeight||0,scrollHeight:Math.max(doc.scrollHeight||0,(document.body&&document.body.scrollHeight)||0)});`
    + `}`
    + `function resolveReportedWidth(base){`
    + `var doc=document.documentElement||{};`
    + `return sizeController.resolveWidth({baseWidth:base,clientWidth:Math.max(doc.clientWidth||0,window.innerWidth||0)});`
    + `}`
    + `function shouldPublishMeasuredSize(height,width){return sizeController.shouldPublish({height:height,width:width});}`
  )
}

/**
 * 顶层元素在一个方向上占多大：溢出可见时算上溢出（scrollWidth/scrollHeight）；溢出在它自己里面滚动或裁掉时
 * （横向滚动的图表、限高的表格）只算它排版占的大小——里面的 scroll 尺寸不占页面，算进去框会被按超宽缩小、或者撑出一大片空白。
 */
const NodeScrollExtentScript =
  `function nodeScrollExtent(node,axis){`
  + `var extent=(axis==='x'?node.scrollWidth:node.scrollHeight)||0;`
  + `try{var style=window.getComputedStyle(node);if((axis==='x'?style.overflowX:style.overflowY)!=='visible')return 0;}catch(e){}`
  + `return extent;`
  + `}`

/** 静态文档尾部的测量脚本：量 body 里的内容，按控制器收敛后把尺寸报给宿主。 */
function resizeTailScript(
  messages: HtmlArtifactBridgeMessages,
  maxReportedHeight: number,
  maxWidthRatio: number
): string {
  return (
    `(function(){${NodeScrollExtentScript}`
    + `function measureContentSize(target){`
    + `var body=document.body||{};var doc=document.documentElement||{};var viewportWidth=Math.max(doc.clientWidth||0,window.innerWidth||0);`
    + `var nodes=target?Array.prototype.slice.call(target.children||[]):[];`
    + `var contentWidth=0;var height=0;nodes.forEach(function(node){`
    + `if(!node)return;var rect=node.getBoundingClientRect?node.getBoundingClientRect():{width:0,height:0,bottom:0};`
    + `contentWidth=Math.max(contentWidth,nodeScrollExtent(node,'x'),node.offsetWidth||0,Math.ceil(rect.width||0));`
    // rect.bottom 不含元素自身的 margin-bottom,漏算会让 iframe 比真实排版矮出一条滚动条。
    + `var mb=0;try{mb=parseFloat(window.getComputedStyle(node).marginBottom)||0;}catch(e){}`
    + `height=Math.max(height,nodeScrollExtent(node,'y'),node.offsetHeight||0,Math.ceil(rect.height||0),Math.ceil((rect.bottom||0)+mb));`
    + `});`
    + `var overflowWidth=Math.max(target&&target.scrollWidth||0,body.scrollWidth||0,doc.scrollWidth||0);`
    + `if(overflowWidth>viewportWidth+1)contentWidth=Math.max(contentWidth,overflowWidth);`
    + `var width=contentWidth||viewportWidth||overflowWidth;`
    + `if(target&&target!==body){height=Math.max(height,target.scrollHeight||0,target.offsetHeight||0);}`
    // 子元素 rect.bottom 不含 body 的底部 padding/margin,漏算会让 iframe 比内容矮一截、
    // 逼出一条残留滚动条。补上 body 的 padding/border/margin 底部空间,让框正好等于内容。
    + `try{var bs=window.getComputedStyle(document.body);height+=(parseFloat(bs.paddingBottom)||0)+(parseFloat(bs.marginBottom)||0)+(parseFloat(bs.borderBottomWidth)||0);}catch(e){}`
    + `return{width:Math.max(1,Math.ceil(width)),height:Math.max(1,Math.ceil(height))};`
    + `}`
    // 高与宽都在统一控制器内收敛并受硬上限约束;超过上限时保留 iframe 内部滚动/裁剪。
    + `${sizeControllerScript(maxReportedHeight, maxWidthRatio)}function reportHeight(){`
    + `var size=measureContentSize(document.body);`
    + `var height=resolveReportedHeight(size.height);`
    + `var width=resolveReportedWidth(size.width);`
    + `if(!shouldPublishMeasuredSize(height,width))return;`
    + `window.parent.postMessage({type:${jsString(messages.resize)},height:height,width:width,naturalHeight:height,naturalWidth:width,rendered:true},'*');`
    + `}`
    + `if(window.ResizeObserver){new ResizeObserver(reportHeight).observe(document.body);}`
    + `if(window.MutationObserver&&(document.documentElement||document.body)){new MutationObserver(function(){invalidateHeightMeasurement();reportHeight();}).observe(document.documentElement||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class','width','height']});}`
    + `window.addEventListener('resize',reportHeight);`
    + `window.addEventListener('load',function(){setTimeout(reportHeight,120);setTimeout(reportHeight,420);});`
    + `setTimeout(reportHeight,40);`
    + `})();`
  )
}

/** 渲染运行时：把一份 HTML 对比着落到根节点上，顺带管住脚本激活与 DOM ready 的兼容。 */
function renderRuntimeScript(rootExpression: string): string {
  return (
    `var root=${rootExpression};`
    + `function readPatchId(patch){return patch&&String(patch.scriptId||patch.styleId||patch.target||'');}`
    + `function reportPatchError(error,patch,phase){`
    + `try{`
    + `var meta={phase:phase||'patch'};`
    + `if(patch&&patch.type)meta.patchType=String(patch.type);`
    + `var patchId=readPatchId(patch);`
    + `if(patchId)meta.patchId=patchId;`
    + `if(window.__htmlArtifactReportRuntimeError){window.__htmlArtifactReportRuntimeError(error||'制品补丁应用失败',meta);return;}`
    + `}catch(ignore){}`
    + `}`
    + `function createArtifactEvent(name){`
    + `try{return new Event(name,{bubbles:true});}catch(ignore){var event=document.createEvent('Event');event.initEvent(name,true,false);return event;}`
    + `}`
    + `function invokeReadyListener(listener,event){`
    + `try{`
    + `if(typeof listener==='function'){listener.call(document,event);return;}`
    + `if(listener&&typeof listener.handleEvent==='function'){listener.handleEvent(event);}`
    + `}catch(error){reportPatchError(error,null,'script');}`
    + `}`
    + `function installLateDomReadyShim(){`
    + `if(document.__htmlArtifactLateDomReadyShim)return;`
    + `document.__htmlArtifactLateDomReadyShim=true;`
    + `var originalAddEventListener=document.addEventListener;`
    + `document.addEventListener=function(type,listener,options){`
    + `if(type==='DOMContentLoaded'&&document.readyState!=='loading'&&listener){`
    + `var event=createArtifactEvent('DOMContentLoaded');`
    + `setTimeout(function(){invokeReadyListener(listener,event);},0);`
    + `return;`
    + `}`
    + `return originalAddEventListener.call(document,type,listener,options);`
    + `};`
    + `}`
    + `function dispatchArtifactReady(){`
    + `try{`
    + `document.dispatchEvent(createArtifactEvent('velaros:artifact-ready'));`
    + `if(root){root.dispatchEvent(createArtifactEvent('velaros:artifact-ready'));}`
    + `window.dispatchEvent(createArtifactEvent('velaros:artifact-ready'));`
    + `}catch(error){reportPatchError(error,null,'render');}`
    + `}`
    + `installLateDomReadyShim();`
    + `function isAllowedExternalScript(src){`
    + `try{var raw=String(src||'').trim();if(raw.indexOf('//')===0)raw='https:'+raw;var url=new URL(raw,window.location.href);return url.protocol==='https:';}catch(error){return false;}`
    + `}`
    + `function activateScripts(){`
    + `var scripts=root?Array.prototype.slice.call(root.querySelectorAll('script:not([data-velaros-script-activated])')):[];`
    + `function activateScriptAt(index){`
    + `if(index>=scripts.length)return;`
    + `var script=scripts[index];`
    + `var next=document.createElement('script');`
    + `next.setAttribute('data-velaros-script-activated','true');`
    + `var hasAllowedSrc=false;var hasBlockedSrc=false;`
    + `Array.prototype.slice.call(script.attributes).forEach(function(attr){var attrName=String(attr.name||'').toLowerCase();if(attrName==='src'){if(isAllowedExternalScript(attr.value)){hasAllowedSrc=true;next.setAttribute(attr.name,attr.value);return;}hasBlockedSrc=true;next.setAttribute('data-blocked-src',attr.value);return;}next.setAttribute(attr.name,attr.value);});`
    + `next.onerror=function(event){reportPatchError(event&&event.error||'制品脚本加载失败',{type:'script',scriptId:next.getAttribute('data-artifact-script')||next.src||'inline'},'script');};`
    + `if(hasAllowedSrc){next.async=false;next.onload=function(){activateScriptAt(index+1);};next.onerror=function(event){reportPatchError(event&&event.error||'制品脚本加载失败',{type:'script',scriptId:next.getAttribute('data-artifact-script')||next.src||'inline'},'script');activateScriptAt(index+1);};if(script.parentNode){script.parentNode.replaceChild(next,script);}else{activateScriptAt(index+1);}return;}`
    + `if(hasBlockedSrc){reportPatchError('已拦下非 https 的外部脚本: '+next.getAttribute('data-blocked-src'),{type:'script',scriptId:next.getAttribute('data-artifact-script')||next.getAttribute('data-blocked-src')||'inline'},'script');}`
    + `next.__velarosScriptSource=scriptSource(script);`
    + `next.text=script.text||script.textContent||'';`
    + `if(script.parentNode){script.parentNode.replaceChild(next,script);}`
    + `activateScriptAt(index+1);`
    + `}`
    + `activateScriptAt(0);`
    + `}`
    + `function sameNode(a,b){return a&&b&&a.nodeType===b.nodeType&&(a.nodeType!==1||a.nodeName===b.nodeName);}`
    + `function syncAttributes(target,source){`
    + `if(target.nodeType!==1||source.nodeType!==1)return;`
    + `Array.prototype.slice.call(target.attributes).forEach(function(attr){if(!source.hasAttribute(attr.name))target.removeAttribute(attr.name);});`
    + `Array.prototype.slice.call(source.attributes).forEach(function(attr){if(target.getAttribute(attr.name)!==attr.value)target.setAttribute(attr.name,attr.value);});`
    + `}`
    + `function scriptSource(script){`
    + `return Array.prototype.map.call(script.attributes,function(attr){return attr.name+'='+attr.value;}).sort().join('\\n')+'\\n'+(script.text||script.textContent||'');`
    + `}`
    + `function patchNode(target,source){`
    + `if(!sameNode(target,source)){target.parentNode&&target.parentNode.replaceChild(source.cloneNode(true),target);return;}`
    + `if(target.nodeType===3){if(target.nodeValue!==source.nodeValue)target.nodeValue=source.nodeValue;return;}`
    // 跑过的脚本：内容没变就原样留着，换了内容就换成新的一份再激活。照常同步属性会抹掉激活标记，脚本每次渲染都重跑一遍
    // （事件挂两次、图画两遍，顶层 const 报重复声明）。
    + `if(target.nodeName==='SCRIPT'&&target.hasAttribute('data-velaros-script-activated')){`
    + `if(target.__velarosScriptSource!==scriptSource(source)&&target.parentNode)target.parentNode.replaceChild(source.cloneNode(true),target);`
    + `return;`
    + `}`
    + `syncAttributes(target,source);patchChildren(target,source);`
    + `}`
    + `function patchChildren(target,source){`
    + `var sourceChildren=Array.prototype.slice.call(source.childNodes);`
    + `var targetChild=target.firstChild;`
    + `sourceChildren.forEach(function(sourceChild){`
    + `if(!targetChild){target.appendChild(sourceChild.cloneNode(true));return;}`
    + `var nextTarget=targetChild.nextSibling;`
    + `patchNode(targetChild,sourceChild);`
    + `targetChild=nextTarget;`
    + `});`
    + `while(targetChild){var next=targetChild.nextSibling;target.removeChild(targetChild);targetChild=next;}`
    + `}`
    + `function render(html){`
    + `if(!root)return;`
    + `var template=document.createElement('template');`
    + `template.innerHTML=String(html||'');`
    + `patchChildren(root,template.content);`
    + `activateScripts();`
    + `dispatchArtifactReady();`
    + `}`
  )
}

/** 外壳文档尾部的脚本：监听宿主的渲染消息，量出尺寸报回去。 */
function liveRenderTailScript(
  rootId: string,
  messages: HtmlArtifactBridgeMessages,
  maxReportedHeight: number,
  maxWidthRatio: number
): string {
  return (
    `(function(){${renderRuntimeScript(
      `document.getElementById(${jsString(rootId)})`
    )}${NodeScrollExtentScript}function measureContentSize(target){`
    + `var body=document.body||{};var doc=document.documentElement||{};var viewportWidth=Math.max(doc.clientWidth||0,window.innerWidth||0);`
    + `var rootRect=target&&target.getBoundingClientRect?target.getBoundingClientRect():{top:0,left:0};`
    + `var nodes=target?Array.prototype.slice.call(target.children||[]):[];`
    + `var contentWidth=0;var height=0;function measureNode(node,originRect){`
    + `if(!node)return;var rect=node.getBoundingClientRect?node.getBoundingClientRect():{width:0,height:0,bottom:0,right:0};`
    + `var right=Math.ceil((rect.right||0)-(originRect.left||0));var bottom=Math.ceil((rect.bottom||0)-(originRect.top||0));`
    + `contentWidth=Math.max(contentWidth,nodeScrollExtent(node,'x'),node.offsetWidth||0,Math.ceil(rect.width||0),right);`
    + `height=Math.max(height,nodeScrollExtent(node,'y'),node.offsetHeight||0,Math.ceil(rect.height||0),bottom);`
    + `}nodes.forEach(function(node){`
    + `measureNode(node,rootRect);`
    + `});`
    + `if(contentWidth&&target&&target!==body&&window.getComputedStyle){var style=window.getComputedStyle(body);contentWidth+=parseFloat(style.paddingLeft)||0;contentWidth+=parseFloat(style.paddingRight)||0;}`
    + `var overflowWidth=Math.max(target&&target.scrollWidth||0,body.scrollWidth||0,doc.scrollWidth||0);`
    + `if(overflowWidth>viewportWidth+1)contentWidth=Math.max(contentWidth,overflowWidth);`
    + `var width=contentWidth||viewportWidth||overflowWidth;`
    + `if(target&&target!==body){var bodyRect=body.getBoundingClientRect?body.getBoundingClientRect():{top:0,left:0};var bodyNodes=Array.prototype.slice.call(body.children||[]);bodyNodes.forEach(function(node){if(node===target)return;measureNode(node,bodyRect);});height=Math.max(height,target.scrollHeight||0,target.offsetHeight||0);}`
    // 子元素 bottom 是相对 root 顶的偏移:root 之上的空间(body paddingTop/margin)与 body 的
    // 底部 padding/margin/border 都不在其中。漏算会让子元素测量系统性偏矮(如 16px 上下
    // padding 共差 48px),与 scrollHeight 真值分歧——这正是振荡的分歧源头,必须补齐。
    + `height+=Math.max(0,Math.ceil((rootRect.top||0)+(window.scrollY||0)));`
    + `try{var bs=window.getComputedStyle(document.body);height+=(parseFloat(bs.paddingBottom)||0)+(parseFloat(bs.marginBottom)||0)+(parseFloat(bs.borderBottomWidth)||0);}catch(e){}`
    + `return{width:Math.max(1,Math.ceil(width)),height:Math.max(1,Math.ceil(height))};`
    + `}`
    + `var hasRendered=false;`
    // 与静态文档路径共用同一控制器:精确收敛、源头去重、反馈冻结和硬上限。
    + `${sizeControllerScript(maxReportedHeight, maxWidthRatio)}function reportHeight(){`
    + `if(!hasRendered)return;`
    + `var size=measureContentSize(root||document.body);`
    + `var height=resolveReportedHeight(size.height);`
    + `var width=resolveReportedWidth(size.width);`
    + `if(!shouldPublishMeasuredSize(height,width))return;`
    + `window.parent.postMessage({type:${jsString(messages.resize)},height:height,width:width,naturalHeight:height,naturalWidth:width,rendered:true},'*');`
    + `}`
    + `function reportSoon(){`
    + `setTimeout(reportHeight,0);setTimeout(reportHeight,80);setTimeout(reportHeight,360);`
    + `}`
    + `window.addEventListener('message',function(event){`
    + `if(event.source!==window.parent)return;`
    + `var data=event.data||{};`
    + `if(data.type===${jsString(messages.render)}){invalidateHeightMeasurement();render(data.html);hasRendered=true;reportSoon();}`
    + `});`
    + `if(window.ResizeObserver){var resizeObserver=new ResizeObserver(reportHeight);if(root)resizeObserver.observe(root);if(document.body)resizeObserver.observe(document.body);}`
    + `if(window.MutationObserver&&(document.documentElement||document.body)){new MutationObserver(function(){invalidateHeightMeasurement();reportSoon();}).observe(document.documentElement||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class','width','height']});}`
    + `window.addEventListener('resize',reportHeight);`
    + `window.addEventListener('load',function(){setTimeout(reportHeight,80);setTimeout(reportHeight,360);});`
    + `setTimeout(reportHeight,40);`
    + `})();`
  )
}

/** 静态文档尾部的就绪脚本：装上迟到 DOMContentLoaded 的兼容，再发一次就绪事件，与外壳文档渲染完成后一致。 */
function readyTailScript(): string {
  return `(function(){${renderRuntimeScript('document.body')}dispatchArtifactReady();})();`
}

/** 造一份内容已经齐了的静态制品文档。 */
export function buildHtmlArtifactDocument(
  rawContent: string,
  options: HtmlArtifactDocumentOptions = {}
): string {
  const content = normalizeHtmlArtifactSource(rawContent)
  const kind = options.contentKind ?? inferHtmlArtifactContentKind(content)
  const messages = resolveBridgeMessages(options.bridgeMessages)
  const maxReportedHeight = resolveMaxReportedHeight(options.maxReportedHeight)
  const maxWidthRatio = resolveMaxWidthRatio(options.maxWidthRatio)
  const bodyStyle = resolveBodyStyle(kind, options.bodyStyle)
  const svgCss = kind === 'svg' ? options.svgFitCss ?? '' : ''

  return (
    `<!doctype html><html><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<style>${HIDE_IFRAME_SCROLLBAR_CSS}${options.designCss ?? ''}${svgCss}body{${bodyStyle}}</style>`
    + `<script>${bridgeHeadScript(messages)}</script></head><body>${content}<script>${readyTailScript()}</script>`
    + `<script>${resizeTailScript(messages, maxReportedHeight, maxWidthRatio)}</script></body></html>`
  )
}

/** 造一份外壳文档：内容随后经消息桥送进去。 */
export function buildHtmlArtifactShellDocument(
  options: HtmlArtifactShellDocumentOptions = {}
): string {
  const rootId = options.rootId ?? HtmlArtifactDefaults.rootId
  const kind = options.contentKind ?? 'html'
  const messages = resolveBridgeMessages(options.bridgeMessages)
  const maxReportedHeight = resolveMaxReportedHeight(options.maxReportedHeight)
  const maxWidthRatio = resolveMaxWidthRatio(options.maxWidthRatio)
  const bodyStyle = resolveBodyStyle(kind, options.bodyStyle)
  const svgCss = kind === 'svg' ? options.svgFitCss ?? '' : ''

  return (
    `<!doctype html><html><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<style>${HIDE_IFRAME_SCROLLBAR_CSS}${options.designCss ?? ''}${svgCss}body{${bodyStyle}}#${escapeHtmlAttribute(rootId)}{width:100%;min-width:0;}</style>`
    + `<script>${bridgeHeadScript(messages)}</script></head><body>`
    + `<div id="${escapeHtmlAttribute(rootId)}"></div>`
    + `<script>${liveRenderTailScript(rootId, messages, maxReportedHeight, maxWidthRatio)}</script></body></html>`
  )
}
