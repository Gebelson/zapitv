import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTvKeyboardText, isRemoteConfirmEvent } from '../src/core/tv/tvKeyboardEvent';
const event=(key:string,code:string,keyCode:number,extra:Partial<KeyboardEvent>={})=>({key,code,keyCode,which:keyCode,...extra} as KeyboardEvent);
for(const [key,code,number]of [['Enter','KeyB',66],['Enter','Enter',13],['Select','',13],['OK','',65385],['Unidentified','',66],['','',66]] as const){
 test(`remote confirmation ${key||'empty'}/${code}/${number}`,()=>{assert.equal(isRemoteConfirmEvent(event(key,code,number)),true);assert.equal(getTvKeyboardText(event(key,code,number)),null);});
}
for(const [key,code,number,text]of [['b','KeyB',66,'b'],['B','KeyB',66,'B'],['Unidentified','KeyB',66,'b'],['','KeyB',66,'b'],[' ','Space',32,' '],['3','Digit3',51,'3']] as const){
 test(`physical text ${key||'empty'}/${code}`,()=>{assert.equal(isRemoteConfirmEvent(event(key,code,number)),false);assert.equal(getTvKeyboardText(event(key,code,number)),text);});
}
test('modifiers and IME do not inject text; physical key metadata supplies case',()=>{
 for(const extra of [{ctrlKey:true},{altKey:true},{metaKey:true},{isComposing:true}])assert.equal(getTvKeyboardText(event('b','KeyB',66,extra)),null);
 assert.equal(getTvKeyboardText(event('Unidentified','KeyB',66,{shiftKey:true})),'B');
 assert.equal(getTvKeyboardText(event('ArrowLeft','ArrowLeft',37)),null);
});
