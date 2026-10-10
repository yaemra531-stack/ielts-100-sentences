import {validateBank} from '../core.js';
import {validateChunks} from '../chunks-core.js';
export const bank=validateBank({title:'原创测试',sentences:Array.from({length:100},(_,i)=>({
  id:`s${i+1}`,chinese:`这是第${i+1}句原创测试。`,answers:[`I read book number ${i+1} after lunch.`],hint:'after lunch'
}))});
export const chunks=validateChunks({format:'ielts100-chunks',version:1,title:'原创测试词伙',sentences:bank.sentences.map((s,i)=>({
  ...s,number:i+1,english:s.answers[0],chunks:[{id:`c${i+1}a`,english:`book number ${i+1}`,meaning:`第${i+1}本书`,source:'hint'},
    {id:`c${i+1}b`,english:'after lunch',meaning:'午饭后',source:'hint'}]
}))});
